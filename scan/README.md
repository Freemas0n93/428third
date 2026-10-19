# Scan → web pipeline

Source: `Showroom_Complete_3D_Export.zip` (v33, source commit `4ca45310`), received 2026-10-18.
Meters, +Y up, datum A at the origin. The export is a registered, corrected model (three ground scans + upper scan + modeled corrections), not a raw capture.

## What the app loads

| File id | Layer (export group) | Source tris | Web tris | Draw calls | Size | Default |
|---|---|---:|---:|---:|---:|---|
| 01a | 01 Ground scan — Scan 01, hall (current contents) | 89,002 | 27,290 | 9 | 2.4 MB | off |
| 01b | 01 Ground scan — Scan 02, back rooms R01–R07 | 378,343 | 84,041 | 11 | 3.0 MB | on |
| 01c | 01 Ground scan — Scan 03, upper-right storage | 371,803 | 81,791 | 5 | 1.7 MB | on |
| 02 | 02 Ground corrected architecture & fixtures | 242,789 | 90,984 | 90 | 1.8 MB | on |
| 03 | 03 Stairs & structural details | 1,067 | 1,067 | 4 | 0.05 MB | on |
| 04 | 04 Upper scan | 363,113 | 92,147 | 15 | 4.1 MB | on |
| 05 | 05 Upper rooms & mezzanine (without services) | 175,685 | 91,791 | 20 | 1.0 MB | on |
| 05s | 05 Upper ducts, pipes, conduit | 154,410 | 52,121 | 2 | 0.2 MB | on |
| 08 | 08 Kitchenette passage & restroom | 337,565 | 43,139 | 4 | 2.3 MB | on |
| 06 | 06 Exterior envelope & street | 138,979 | 65,999 | 105 | 3.0 MB | on demand |
| 07 | 07 Roof + rooftop units | 85,991 | 45,494 | 18 | 2.7 MB | on demand |
| | **First load (Ground level, defaults)** | | **301,022** | **114** | **8.8 MB** | |
| | **Interior, both levels (defaults)** | | **537,081** | **151** | **14.1 MB** | |
| | Everything incl. hall scan, exterior, roof | 2,338,747 | 675,864 | 283 | 22.3 MB | |

Textures: 256 source images (165 MPix, up to 4096²) → KTX2/Basis ETC1S, capped at 2048². GPU texture memory drops roughly 6–8× versus decoded JPEG, which is what keeps iPad Safari stable.

## Steps

```bash
# 1. split into per-layer GLBs; bakes flat material colours into vertex colours and drops
#    normals/UVs that unlit or untextured materials never read (lets the simplifier weld faces)
python3 -I scan/pipeline/split.py scan/raw/Showroom_Corrected_Full_Detail.glb scan/work/split

# 2. simplify + meshopt-compress + KTX2 per layer (gltfpack 0.25, settings inside the script)
GLTFPACK=/path/to/gltfpack scan/pipeline/optimize.sh scan/work/split scan/work/opt

# 3. copy into public/models/building with content hashes; regenerates src/data/modelLayers.ts
python3 -I scan/pipeline/install.py scan/work/opt .
```

Settings rationale: scan layers use `-se 0.005 -slb` (0.5 % error, borders locked so atlas chunks don't crack); modeled layers use tight error (`0.0005`–`0.002`) because one merged mesh spans 15–40 m and a looser bound erased small fixtures (robot arms, cable rings, the ALLSIDES plaque) in testing. Upper services need `-sa`: the duct is hundreds of disconnected rings that no error-bounded simplifier can merge.

Verified by rendering source vs optimized from seven fixed cameras (hall both directions, mezzanine, plans, exterior) in headless three.js r180; differences limited to the clear duct's ring count.

## Measurements taken from the export (not yet tape-verified)

| Dimension | Model | Plan drawing |
|---|---:|---:|
| Hall length (Third St wall → back) | 34.8 m / 1,370 in | ≈1,370 in |
| Hall width (window wall → brick wall) | 13.0 m / 512 in | ≈510 in |
| Building footprint, ground | 47.0 × 24.2 m | — |
| Upper floor walking surface | 21.4 × 14.3 m at y = 2.745 | ≈868 × 574 in overall |
| Floor-to-floor | 2.745 m / 108 in | — |
| Back-room ceiling | 2.57 m / 101 in | — |
| Hall roof shell, eaves → ridge | ≈5.6 → 7.2 m | — |
| 16-station grid | 8.0 m along the hall × 10.0 m across | 314.96 × 393.70 in |

The plan drawings were made from this same model, so agreement between them is not independent verification. Two tape measurements (hall width at the Third St wall, hall length from the Third St wall to the back-room partition) are still needed before the calibration is called done; a correction goes in `scenes.calibration`, not into the files.
