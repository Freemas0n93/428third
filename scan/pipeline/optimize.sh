#!/bin/bash
# usage: optimize.sh SPLITDIR OUTDIR   — per-layer gltfpack settings (ratio, error, flags)
GP=${GLTFPACK:-gltfpack}; S=$1; O=$2; mkdir -p $O
declare -A P=(
 [01a]="-si 0.30 -se 0.005 -slb"   # hall scan (existing furniture)
 [01b]="-si 0.22 -se 0.005 -slb"   # ground rooms R01-R07
 [01c]="-si 0.22 -se 0.005 -slb"   # upper-right storage
 [02]="-si 0.50 -se 0.0005"        # corrected hall architecture + fixtures (keep small parts)
 [03]=""                           # stairs details, 1k tris
 [04]="-si 0.22 -se 0.005 -slb"    # upper scan
 [05]="-si 0.50 -se 0.001"         # upper rooms + mezzanine (modeled)
 [05s]="-si 0.35 -se 0.01 -sa"     # upper ducts/pipes: hundreds of tiny rings, needs aggressive mode
 [06]="-si 0.45 -se 0.002"         # exterior
 [07]="-si 0.50 -se 0.002"         # roof
 [08]="-si 0.12 -se 0.005 -slb"    # kitchenette passage + restroom scan
)
for id in "${!P[@]}"; do
  ( $GP -i $S/$id.glb -o $O/$id.glb -cc -tc -tl 2048 -tj 2 ${P[$id]} -v > $O/$id.log 2>&1
    echo "$id ${P[$id]} | $(grep 'input: .*draw calls' $O/$id.log | grep -o '[0-9]* triangles' | head -1) -> $(grep 'output: .*draw calls' $O/$id.log | grep -o '([0-9]* triangles' | head -1 | tr -d '(') | $(grep 'output: .*draw calls' $O/$id.log | grep -o '[0-9]* draw calls' | head -1) | $(du -h $O/$id.glb | cut -f1)" ) &
done; wait
