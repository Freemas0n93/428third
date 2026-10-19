"""Split the corrected showroom GLB into one GLB per top-level layer.

- Keeps the root transform and the layer's subtree (names intact).
- Bakes flat (untextured, single-texture-free) material colors into COLOR_0 and
  collapses those materials into a handful of shared ones, so gltfpack can merge
  draw calls. Textured / normal-mapped / clearcoat materials are kept as-is.
- Drops extras.
usage: python3 -I split.py SRC.glb OUTDIR
"""
import sys, json, os, re, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb import read_glb, write_glb, accessor

src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
js, binc = read_glb(src)
root_i = js["scenes"][js.get("scene", 0)]["nodes"][0]
root = js["nodes"][root_i]


def slug(name):
    s = name.split("/")[0].strip()
    return re.sub(r"[^0-9A-Za-z]+", "", s).lower()


def is_flat(m):
    pbr = m.get("pbrMetallicRoughness", {})
    if any(k in pbr for k in ("baseColorTexture", "metallicRoughnessTexture")):
        return False
    if any(k in m for k in ("normalTexture", "occlusionTexture", "emissiveTexture")):
        return False
    ext = set(m.get("extensions", {}))
    if ext - {"KHR_materials_unlit"}:
        return False
    if any(v for v in m.get("emissiveFactor", [0, 0, 0])):
        return False
    return True


jobs = []
for layer_i in root["children"]:
    layer = js["nodes"][layer_i]
    if slug(layer["name"]) == "01":
        for j, c in enumerate(layer["children"]):
            jobs.append((c, "01" + "abc"[j], layer["name"] + " / " + js["nodes"][c]["name"], layer_i))
    else:
        jobs.append((layer_i, slug(layer["name"]), layer["name"], None))

# Split building services (ducts, pipe banks) off the upper-floor rooms so they can be
# simplified harder than the furniture/rooms. None = no filter.
SERVICES = lambda nm: "services" in nm.lower()
FILTERS = {"05": ("exclude", SERVICES)}
extra = []
for j in jobs:
    if j[1] in FILTERS:
        extra.append((j[0], j[1] + "s", j[2] + " / services", j[3]))
        FILTERS[j[1] + "s"] = ("only", FILTERS[j[1]][1])
jobs += extra


def subtree_has(ni, pred):
    n = js["nodes"][ni]
    return pred(n.get("name", "")) or any(subtree_has(c, pred) for c in n.get("children", []))


for layer_i, key, name, parent_i in jobs:
    mode, pred = FILTERS.get(key, (None, None))
    layer = js["nodes"][layer_i]
    out = {"asset": {"version": "2.0", "generator": "428third split.py"},
           "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [], "meshes": [], "materials": [],
           "textures": [], "images": [], "samplers": [], "accessors": [], "bufferViews": [],
           "buffers": [{"byteLength": 0}]}
    chunks, off = [], 0
    amap, tmap, imap, smap, mmap, shared = {}, {}, {}, {}, {}, {}
    used_ext = set()

    def add_bytes(b, target=None):
        global off
        pad = (-off) % 4
        if pad:
            chunks.append(b"\x00" * pad); off += pad
        bv = {"buffer": 0, "byteOffset": off, "byteLength": len(b)}
        if target:
            bv["target"] = target
        chunks.append(b); off += len(b)
        out["bufferViews"].append(bv)
        return len(out["bufferViews"]) - 1

    def copy_accessor(ai, target=None):
        if ai in amap:
            return amap[ai]
        a = dict(js["accessors"][ai])
        arr = accessor(js, binc, ai)
        if a.get("normalized"):  # re-read raw for normalized ints
            bv = js["bufferViews"][a["bufferView"]]
            raw = np.frombuffer(binc, dtype=np.uint8, count=bv["byteLength"], offset=bv.get("byteOffset", 0))
            a["bufferView"] = add_bytes(raw.tobytes(), target); a.pop("byteOffset", None)
        else:
            a["bufferView"] = add_bytes(np.ascontiguousarray(arr).tobytes(), target)
            a.pop("byteOffset", None)
        out["accessors"].append(a)
        amap[ai] = len(out["accessors"]) - 1
        return amap[ai]

    def new_accessor(arr, ctype, typ, target=34962, minmax=False):
        a = {"bufferView": add_bytes(np.ascontiguousarray(arr).tobytes(), target),
             "componentType": ctype, "count": int(len(arr)), "type": typ}
        if minmax:
            a["min"] = arr.min(0).tolist(); a["max"] = arr.max(0).tolist()
        out["accessors"].append(a)
        return len(out["accessors"]) - 1

    def copy_image(ii):
        if ii in imap:
            return imap[ii]
        im = dict(js["images"][ii])
        bv = js["bufferViews"][im["bufferView"]]
        raw = binc[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
        im["bufferView"] = add_bytes(raw)
        out["images"].append(im)
        imap[ii] = len(out["images"]) - 1
        return imap[ii]

    def copy_texture(ti):
        if ti in tmap:
            return tmap[ti]
        t = dict(js["textures"][ti])
        if "source" in t:
            t["source"] = copy_image(t["source"])
        if "sampler" in t:
            si = t["sampler"]
            if si not in smap:
                out["samplers"].append(js["samplers"][si]); smap[si] = len(out["samplers"]) - 1
            t["sampler"] = smap[si]
        out["textures"].append(t)
        tmap[ti] = len(out["textures"]) - 1
        return tmap[ti]

    def remap_texinfo(obj):
        for k, v in list(obj.items()):
            if k.endswith("Texture") and isinstance(v, dict) and "index" in v:
                v = dict(v); v["index"] = copy_texture(v["index"]); obj[k] = v
            elif isinstance(v, dict):
                obj[k] = remap_texinfo(dict(v))
        return obj

    def copy_material(mi):
        if mi in mmap:
            return mmap[mi]
        m = json.loads(json.dumps(js["materials"][mi]))
        m.pop("extras", None)
        m = remap_texinfo(m)
        used_ext.update(m.get("extensions", {}).keys())
        out["materials"].append(m)
        mmap[mi] = len(out["materials"]) - 1
        return mmap[mi]

    def shared_flat(m):
        unlit = "KHR_materials_unlit" in m.get("extensions", {})
        pbr = m.get("pbrMetallicRoughness", {})
        alpha = m.get("alphaMode", "OPAQUE")
        base = pbr.get("baseColorFactor", [1, 1, 1, 1])
        if alpha == "OPAQUE" or (alpha == "BLEND" and base[3] >= 0.999):
            alpha = "OPAQUE"
        k = (unlit, bool(m.get("doubleSided")), alpha,
             round(pbr.get("metallicFactor", 1.0), 1), round(pbr.get("roughnessFactor", 1.0), 1),
             m.get("alphaCutoff", 0.5) if alpha == "MASK" else None)
        if k not in shared:
            nm = {"name": f"{key} | flat {'unlit' if unlit else 'pbr'} {alpha.lower()} m{k[3]} r{k[4]}",
                  "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": k[3], "roughnessFactor": k[4]},
                  "doubleSided": k[1], "alphaMode": alpha}
            if alpha == "MASK":
                nm["alphaCutoff"] = k[5]
            if unlit:
                nm["extensions"] = {"KHR_materials_unlit": {}}; used_ext.add("KHR_materials_unlit")
            out["materials"].append(nm)
            shared[k] = len(out["materials"]) - 1
        return shared[k], base

    stats = collections.Counter()
    mesh_map = {}

    def copy_mesh(mi):
        if mi in mesh_map:
            return mesh_map[mi]
        me = js["meshes"][mi]
        prims = []
        for p in me["primitives"]:
            np_ = {"attributes": {}, "mode": p.get("mode", 4)}
            mat0 = js["materials"][p["material"]] if "material" in p else None
            unlit = mat0 is not None and "KHR_materials_unlit" in mat0.get("extensions", {})
            flat = mat0 is not None and is_flat(mat0) and "COLOR_0" not in p["attributes"]
            for an, ai in p["attributes"].items():
                # Unlit shading ignores normals; flat-colour prims ignore UVs. Dropping them lets
                # gltfpack weld the per-face vertices so the simplifier can actually work.
                if unlit and an == "NORMAL":
                    stats["normals_dropped"] += 1; continue
                if flat and an.startswith("TEXCOORD"):
                    continue
                np_["attributes"][an] = copy_accessor(ai, 34962)
            if "indices" in p:
                np_["indices"] = copy_accessor(p["indices"], 34963)
            mat = js["materials"][p.get("material", 0)] if "material" in p else None
            if mat is not None and is_flat(mat) and "COLOR_0" not in p["attributes"]:
                si, base = shared_flat(mat)
                n = js["accessors"][p["attributes"]["POSITION"]]["count"]
                col = np.tile(np.array(base, dtype=np.float32), (n, 1))
                np_["attributes"]["COLOR_0"] = new_accessor(col, 5126, "VEC4")
                np_["material"] = si
                stats["flat_baked"] += 1
            elif mat is not None:
                np_["material"] = copy_material(p["material"])
                stats["kept"] += 1
            prims.append(np_)
        out["meshes"].append({"name": me.get("name", f"mesh{mi}"), "primitives": prims})
        mesh_map[mi] = len(out["meshes"]) - 1
        return mesh_map[mi]

    def copy_node(ni, inside=False):
        n = js["nodes"][ni]
        nm = n.get("name", "")
        if mode == "exclude" and pred(nm):
            return None
        if mode == "only" and not inside and not pred(nm) and not subtree_has(ni, pred):
            return None
        inside = inside or (mode == "only" and pred(nm))
        nn = {k: v for k, v in n.items() if k in ("name", "matrix", "translation", "rotation", "scale")}
        idx = len(out["nodes"]); out["nodes"].append(nn)
        if "mesh" in n and (mode != "only" or inside):
            nn["mesh"] = copy_mesh(n["mesh"])
        kids = [k for k in (copy_node(c, inside) for c in n.get("children", [])) if k is not None]
        if kids:
            nn["children"] = kids
        return idx

    rootcopy = {k: v for k, v in root.items() if k in ("name", "matrix", "translation", "rotation", "scale")}
    out["nodes"].append(rootcopy)
    if parent_i is not None:
        pn = js["nodes"][parent_i]
        pc = {k: v for k, v in pn.items() if k in ("name", "matrix", "translation", "rotation", "scale")}
        out["nodes"].append(pc); pidx = len(out["nodes"]) - 1
        pc["children"] = [copy_node(layer_i)]
        rootcopy["children"] = [pidx]
    else:
        rootcopy["children"] = [copy_node(layer_i)]
    for k in ("textures", "images", "samplers"):
        if not out[k]:
            out.pop(k)
    if used_ext:
        out["extensionsUsed"] = sorted(used_ext)
    binb = b"".join(chunks)
    out["buffers"][0]["byteLength"] = len(binb)
    path = os.path.join(outdir, f"{key}.glb")
    write_glb(path, out, binb)
    print(f"{key:4s} {name[:58]:58s} meshes={len(out['meshes']):4d} materials={len(out['materials']):4d} "
          f"images={len(out.get('images', [])):3d} flat_baked={stats['flat_baked']} kept={stats['kept']} "
          f"normals_dropped={stats['normals_dropped']} -> {os.path.getsize(path)/1e6:.1f} MB")
