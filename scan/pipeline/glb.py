"""Minimal GLB reader/writer + helpers (numpy only)."""
import json, struct
import numpy as np

CTYPE = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, ver, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "not a GLB"
    off = 12
    js, binc = None, None
    while off < length:
        clen, ctype = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        elif ctype == 0x004E4942:
            binc = chunk
        off += 8 + clen
    return js, binc


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(",", ":")).encode("utf-8")
    jb += b" " * ((4 - len(jb) % 4) % 4)
    bb = bytes(binc) + b"\x00" * ((4 - len(binc) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(bb)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(jb), 0x4E4F534A)); f.write(jb)
        f.write(struct.pack("<II", len(bb), 0x004E4942)); f.write(bb)


def accessor(js, binc, idx):
    a = js["accessors"][idx]
    bv = js["bufferViews"][a["bufferView"]]
    dt = CTYPE[a["componentType"]]
    n = NCOMP[a["type"]]
    itemsize = np.dtype(dt).itemsize * n
    stride = bv.get("byteStride", itemsize)
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    cnt = a["count"]
    if stride == itemsize:
        arr = np.frombuffer(binc, dtype=dt, count=cnt * n, offset=start).reshape(cnt, n)
    else:
        raw = np.frombuffer(binc, dtype=np.uint8, count=stride * (cnt - 1) + itemsize, offset=start)
        idxs = (np.arange(cnt)[:, None] * stride + np.arange(itemsize)[None, :])
        arr = raw[idxs].copy().view(dt).reshape(cnt, n)
    if a.get("normalized"):
        info = np.iinfo(dt)
        arr = np.maximum(arr.astype(np.float32) / info.max, -1.0)
    return arr


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def local_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape(4, 4).T
    M = np.eye(4)
    s = np.array(node.get("scale", [1, 1, 1]), dtype=np.float64)
    R = quat_to_mat(node.get("rotation", [0, 0, 0, 1]))
    M[:3, :3] = R * s[None, :]
    M[:3, 3] = node.get("translation", [0, 0, 0])
    return M


def walk(js, root_nodes=None):
    """Yield (node_index, world_matrix, path_names) depth-first."""
    if root_nodes is None:
        root_nodes = js["scenes"][js.get("scene", 0)]["nodes"]
    stack = [(n, np.eye(4), []) for n in reversed(root_nodes)]
    while stack:
        ni, parent, path = stack.pop()
        node = js["nodes"][ni]
        W = parent @ local_matrix(node)
        p = path + [node.get("name", f"node{ni}")]
        yield ni, W, p
        for c in reversed(node.get("children", [])):
            stack.append((c, W, p))


def prim_world_tris(js, binc, prim, W):
    pos = accessor(js, binc, prim["attributes"]["POSITION"]).astype(np.float64)
    pw = pos @ W[:3, :3].T + W[:3, 3]
    if "indices" in prim:
        idx = accessor(js, binc, prim["indices"]).reshape(-1).astype(np.int64)
    else:
        idx = np.arange(len(pos))
    mode = prim.get("mode", 4)
    if mode != 4:
        return pw, None
    return pw, idx.reshape(-1, 3)
