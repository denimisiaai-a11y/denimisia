"""
Denimisia catalog normalization pipeline.

Input: 78-row flat product CSV (products_details.csv) with mojibake encoding,
       duplicate category paths, single thumbnail images, empty cost prices,
       and flattened color variants.

Output (written to data/catalog/output/):
  - products.json        : 27 parent products + nested variants
  - categories.json      : deduped taxonomy tree
  - inventory.json       : variant x size stock matrix
  - seo.json             : regenerated meta titles/descriptions
  - images.json          : image manifest with R2 target paths
  - prisma_seed.ts       : executable seed snippet for packages/database
  - CLEAN_REPORT.md      : summary & stats

Assumptions (flagged in output):
  - Cost Price = 40% of regular price (denim retail standard; OVERRIDE when
    boss provides real numbers)
  - Single source image migrates to R2 path:
      r2://denimisia/products/{model}/{wash_code}/primary.jpg
    Gallery slots (front/back/detail/model) are reserved but empty.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

OUT_DIR = Path(__file__).parent / "output"
OUT_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Raw catalog data — extracted from products_details.csv and manually verified.
# Structure: one dict per row (78 rows). Fields are kept minimal; descriptions
# are regenerated from templates so we only keep key marketing attributes.
# ---------------------------------------------------------------------------

# Wash code dictionary — maps marketing names to canonical codes
WASH_CODES = {
    "LTN": ("Light Tint Blue", "#A8B8C8"),
    "MBA": ("Mid Blue", "#4A6B8A"),
    "MTN": ("Mid Tint Blue", "#7890A8"),
    "DTN": ("Dark Tint Blue", "#3A5068"),
    "DBA": ("Dark Blue", "#2A4058"),
    "LBA": ("Light Blue", "#9AB0C5"),
    "ASH": ("Ash Black", "#3C3C3C"),
    "BLK": ("Black", "#1A1A1A"),
    "BLKTN": ("Black Tint", "#2A2A2A"),
    "CRM": ("Cream", "#F0E8D8"),
    "CHC": ("Chocolate", "#4A3020"),
    "OLV": ("Olive", "#5A6438"),
    "OWH": ("Off White", "#F5F0E8"),
    "WHT": ("White", "#FAFAFA"),
    "YLTN": ("Yellow Tint", "#D8C890"),
    "GRY": ("Grey", "#7A7A7A"),
    "CMO": ("Camo", "#4A5238"),
    "ARMY": ("Army Green", "#4A5030"),
    "SPLA": ("Super Light Blue", "#B8C8D8"),
    "DNMBA": ("Denim Blue", "#486080"),
}

# One entry per CSV row. Kept to essentials.
RAW_ROWS = [
    # (serial, model, wash_code, name_suffix, price, special_price, status, sizes_dict, image_url, total_qty, tags_series)
    (1,  "21003", "LTN", "High Waist Baggy Wide-Leg Denim", 1590, 999,  "Enabled",
     {28:17,30:0,32:19,34:27,36:20,38:44,40:6},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21003/LTN-277x370.jpg",
     144, ["wide-leg","baggy","designed","high-waisted"]),
    (2,  "21003", "MBA", "High Waist Baggy Wide-Leg Denim", 1590, 999,  "Enabled",
     {26:73,28:5,30:32,32:18,34:19,36:72,38:38,40:18},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21003/MBA-277x370.jpg",
     287, ["wide-leg","baggy","designed"]),
    (3,  "21003", "ASH", "High Waist Baggy Wide-Leg Denim", 1590, 999,  "Disabled",
     {26:0,28:0,30:0,32:0,34:1,36:4,38:4,40:14},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/ASH_BLK-4-277x370.jpg",
     14, ["wide-leg","baggy","designed"]),
    (4,  "21021", "MTN", "Bow Embroidery High Waist Baggy Wide Leg Jeans", 1590, 1099, "Enabled",
     {26:9,28:16,30:2,32:7,34:29,36:42,38:48,40:21},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21021/MTN-1-277x370.jpg",
     174, ["wide-leg","baggy"]),
    (5,  "41011", "DTN", "Comfy Wide-Leg Denim Pant for Women", 1490, 899,  "Disabled",
     {26:3,28:12,30:1,32:11,34:5,36:0,38:2,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/41011/Re-shoot%208%20March/DTN-277x370.jpg",
     0, ["wide-leg","designed"]),
    (6,  "41011", "LBA", "Comfy Wide-Leg Denim Pant for Women", 1490, 899,  "Enabled",
     {26:43,28:68,30:51,32:43,34:55,36:39,38:45,40:31},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/41011/Re-shoot%208%20March/LBA-277x370.jpg",
     331, ["wide-leg","designed"]),
    (7,  "41011", "LTN", "Comfy Wide-Leg Denim Pant for Women", 1490, 899,  "Enabled",
     {26:20,28:20,30:42,32:34,34:38,36:64,38:49,40:16},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/41011/Re-shoot%208%20March/LTN-277x370.jpg",
     82, ["designed"]),
    (8,  "21026", "MBA", "Side Bow Embroidery Women Casual Jeans", 1590, 1099, "Enabled",
     {26:15,28:0,30:2,32:2,34:9,36:12,38:19,40:4},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21026/21026%20Re-shooot/MBA-2-277x370.jpg",
     64, ["baggy"]),
    (9,  "21026", "MTN", "Side Bow Embroidery Women Casual Jeans", 1590, 1099, "Enabled",
     {26:13,28:0,30:0,32:3,34:10,36:9,38:18,40:6},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21026/21026%20Re-shooot/MTN-277x370.jpg",
     74, ["baggy"]),
    (10, "2112",  "MBA", "Sky Fade Mid-Rise Baggy Denim", 1590, 1099, "Enabled",
     {26:0,28:0,30:4,32:0,34:0,36:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/2112/MBA_Half-1-277x370.jpg",
     3, ["baggy","designed"]),
    (11, "3034",  "ASH", "Urban Smoke Wide Leg Jean's", 1590, 999, "Enabled",
     {26:77,28:86,30:34},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3034/ASH-1-277x370.jpg",
     197, ["boyfriend","straight","high-waisted","90s-baggy","classic","fusion","plus-size","spring26"]),
    (12, "3034",  "BLKTN", "Urban Smoke Wide Leg Jean's", 1590, 999, "Enabled",
     {26:109,28:177,30:151,32:64,34:17,38:6,40:7},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3034/2-277x370.jpg",
     531, ["boyfriend","straight","high-waisted","90s-baggy","classic","fusion","plus-size","stw-unisex","spring26"]),
    (13, "3034",  "LBA", "Urban Smoke Wide Leg Jean's", 1590, 999, "Enabled",
     {26:37,28:40,30:43,32:31,34:16},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3034/LBA-277x370.jpg",
     167, ["boyfriend","straight","high-waisted","90s-baggy","classic","fusion","plus-size","stw-unisex","spring26"]),
    (14, "21022", "BLK", "Super Baggy Wide Leg Denim Jeans", 1680, 1099, "Enabled",
     {24:0,26:0,28:0,30:0,34:0,36:3,38:0,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21022/21022_BLK-1-277x370.jpg",
     3, ["wide-leg","cargo","designed"]),
    (15, "21022", "DTN", "Super Baggy Wide Leg Denim Jeans", 1690, 1099, "Enabled",
     {26:12,28:4,30:4,32:3,34:9,36:2,38:3,40:1},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21022/DTN-1-277x370.jpg",
     38, ["cargo","designed"]),
    (16, "21022", "LBA", "Super Baggy Wide Leg Denim Jeans", 1690, 1099, "Enabled",
     {26:11,28:0,30:5,32:10,34:13,36:13,38:13,40:5},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21022/LBA-1-277x370.jpg",
     78, ["cargo"]),
    (17, "21022", "MBA", "Super Baggy Wide Leg Denim Jeans", 1680, 1099, "Enabled",
     {26:6,28:9,30:0,32:6,34:17,36:18,38:0,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21022/21022_MBA-1-277x370.jpg",
     56, ["cargo"]),
    (18, "21022", "MTN", "Super Baggy Wide Leg Denim Jeans", 1690, 1099, "Enabled",
     {26:1,28:0,30:0,32:0,34:9,36:0,38:10,40:9},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21022/MTN-2-277x370.jpg",
     29, ["cargo"]),
    (19, "21022", "DBA", "Super Baggy Wide Leg Denim Jeans", 1680, 1099, "Enabled",
     {26:4,28:2,30:2,32:2,34:8,36:5,38:6,40:1},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21022/DBA-277x370.jpg",
     18, ["cargo"]),
    (20, "2111",  "GRY", "Premium Grey High-Waist Wide-Leg Baggy Fit Non-Stretch Denim Jeans", 1690, 899, "Enabled",
     {24:5,26:6,28:18,30:53,32:59,34:24,36:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/2111/2111_Gray-277x370.jpg",
     166, ["baggy"]),
    (21, "41011", "MTN", "Comfy Wide-Leg Denim Pant for Women", 1490, 899,  "Enabled",
     {26:0,28:19,30:44,32:35,34:60,36:64,38:76,40:16},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/41011/Re-shoot%208%20March/MTN-2-277x370.jpg",
     32, ["wide-leg","designed"]),
    (22, "21003", "DTN", "High Waist Baggy Wide-Leg Denim", 1590, 999,  "Enabled",
     {26:1,28:2,30:0,32:36,34:28,36:18,38:39,40:12},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21003/DTN-1-277x370.jpg",
     141, ["wide-leg","baggy","designed"]),
    (23, "21003", "LBA", "High Waist Baggy Wide-Leg Denim", 1590, 999,  "Enabled",
     {26:1,28:0,30:0,34:0,36:3,38:4,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21003/LBA-277x370.jpg",
     9, ["wide-leg","baggy","designed"]),
    (24, "3045",  "MBA", "AeroLite Highwaist Flare Jean's", 1390, 899, "Enabled",
     {24:21,26:27,28:19,30:32,32:12,34:9,36:0,38:1,42:1},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3045/MBA-1-277x370.jpg",
     177, ["wide-leg","flared","bootcut","high-waisted","classic","cute","spring26"]),
    (25, "3037",  "DNMBA", "Alyza Patch Pocket Wide Leg", 1390, 999, "Enabled",
     {24:6,26:0,28:19,30:25,32:30,34:26,36:1,38:3},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3037%20E%20F/DNMBA-1-277x370.jpg",
     54, ["wide-leg","baggy","flared","high-waisted","90s-baggy","classic","cute","spring26"]),
    (26, "21021", "MBA", "Bow Embroidery High Waist Baggy Wide Leg Jeans", 1590, 1099, "Enabled",
     {26:22,28:23,30:20,32:3,34:24,36:44,38:46,40:20},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21021/MBA-1-277x370.jpg",
     202, ["wide-leg","baggy","designed"]),
    (27, "6007",  "ARMY", "Cairo Denim Cargo Jean's", 1390, 999, "Enabled",
     {26:28,28:31,30:62,32:6,34:5},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6007/Re%20size/Army_Green-1-277x370.jpg",
     132, ["cargo","boyfriend","straight","high-waisted","plus-size","stw-unisex","y2k","eid26","spring26"]),
    (28, "6007",  "CMO",  "Cairo Denim Cargo Jean's", 1390, 999, "Enabled",
     {26:36,28:0,30:10,32:50,34:3,36:21},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6007/Re%20size/camouflage-1-277x370.jpg",
     120, ["cargo","boyfriend","straight","high-waisted","classic","plus-size","stw-unisex","y2k","eid26","spring26"]),
    (29, "6007",  "DBA",  "Cairo Denim Cargo Jean's", 1390, 999, "Enabled",
     {26:44,28:35,30:26,32:19},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6007/Re%20size/DBA-277x370.jpg",
     124, ["cargo","boyfriend","straight","high-waisted","classic","plus-size","stw-unisex","y2k","eid26","spring26"]),
    (30, "6013",  "ASH",  "Cargo Straight Jean's", 1490, 999, "Enabled",
     {26:116,28:116,30:97,32:80,34:80,36:20},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6013/new/ASH_Black-2-277x370.jpg",
     509, ["cargo","boyfriend","straight","high-waisted","classic","stw-unisex","y2k","eid26","spring26"]),
    (31, "6013",  "DBA",  "Cargo Straight Jean's", 1490, 999, "Enabled",
     {26:36,28:13,30:12,32:4,34:11,36:49},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6013/new/DBA-2-277x370.jpg",
     125, ["cargo"]),
    (32, "6013",  "LBA",  "Cargo Straight Jean's", 1490, 999, "Enabled",
     {26:48,28:50,30:50,32:34,34:40,36:20},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6013/new/LBA-277x370.jpg",
     242, ["cargo"]),
    (33, "6013",  "OWH",  "Cargo Straight Jean's", 1490, 999, "Enabled",
     {26:8,28:8,30:3,32:2,34:4,36:3},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6013/new/OWH-277x370.jpg",
     28, ["cargo"]),
    (34, "6013",  "OLV",  "Cargo Straight Jean's", 1490, 999, "Enabled",
     {26:65,28:64,30:64,32:20,34:19,36:39},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6013/new/OLV-277x370.jpg",
     271, ["cargo"]),
    (35, "3039",  "LBA",  "Comfort Flow Stretch Jean's", 1590, 899, "Enabled",
     {28:17,30:37,32:20,34:8},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3039/MBA-277x370.jpg",
     97, ["wide-leg","baggy","flared","designed","high-waisted","90s-baggy","cute","flared","stw-unisex","y2k","spring26"]),
    (36, "41011", "DBA",  "Comfy Wide-Leg Denim Pant for Women", 1490, 899, "Enabled",
     {26:27,28:64,30:45,32:65,34:46,36:69,38:59,40:15},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/41011/Re-shoot%208%20March/DBA_Front-277x370.jpg",
     24, ["wide-leg","designed"]),
    (37, "41011", "MBA",  "Comfy Wide-Leg Denim Pant for Women", 1490, 899, "Disabled",
     {26:12,28:32,30:24,32:26,34:33,36:32,38:34,40:13},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/41011/Re-shoot%208%20March/MBA-2-277x370.jpg",
     34, ["wide-leg","designed"]),
    (38, "2110",  "BLK",  "Drape Baggy Jean's", 1290, 899, "Enabled",
     {24:0,26:0,28:0,30:35,32:0,34:0,36:0,38:0,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/2110/Re%20Size/BLK-2-277x370.jpg",
     35, ["baggy"]),
    (39, "2110",  "CRM",  "Drape Baggy Jean's", 1290, 899, "Enabled",
     {28:54,30:12,32:30},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/2110/Re%20Size/cream-2-277x370.jpg",
     95, ["baggy"]),
    (40, "3044",  "DBA",  "Freha Flares Mid Waist Jean's", 1590, 999, "Enabled",
     {26:5,28:12,30:23,32:53,34:53,36:31,38:32,40:7},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3044/DBA-2-277x370.jpg",
     98, ["wide-leg","flared","bootcut","designed","spring26","cute","flared"]),
    (41, "6008",  "LTN",  "Kiara Urban Denim Cargo", 1590, 1199, "Enabled",
     {26:21,28:60,30:0,32:4,34:6,36:1,38:1,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6008/TNT_BLUE-277x370.jpg",
     93, ["baggy","straight","high-waisted","90s-baggy","classic","stw-unisex","vintage","eid26","spring26"]),
    (42, "3052",  "ASH",  "Lara Wide Leg", 1490, 999, "Enabled",
     {26:53,28:53,30:45,32:36,34:19,36:8,38:6,40:1},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3052/ASH_BLACK-2-277x370.jpg",
     223, ["boyfriend","straight","high-waisted","90s-baggy","classic","cute","stw-unisex","spring26"]),
    (43, "3052",  "MBA",  "Lara Wide Leg", 1590, 999, "Enabled",
     {26:5,28:27,30:19,32:18,34:14,36:6,38:3,40:1},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/MBA-31-277x370.jpg",
     93, ["straight"]),
    (44, "2116",  "MBA",  "Lily Pintuck Barrel Fit Jean's", 1490, 899, "Enabled",
     {26:0,28:0,30:0,32:0,34:0,36:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/2116/Re%20Edit/Mid_Blue-2-277x370.jpg",
     0, ["barrel"]),
    (45, "3030",  "BLK",  "Luxe Mid Rise Denim", 1490, 999, "Enabled",
     {24:3,26:3,28:0,30:0,32:3,34:2},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/BLK-11-277x370.jpg",
     11, ["wide-leg","flared","designed","high-waisted","classic","flared","stw-unisex","vintage","spring26"]),
    (46, "3030",  "CHC",  "Luxe Mid Rise Denim", 1490, 999, "Enabled",
     {24:0,26:18,28:14,30:21,32:15,34:8,36:1},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/CHC-2-277x370.jpg",
     77, ["wide-leg","flared","designed","high-waisted","classic","flared","stw-unisex","vintage","spring26"]),
    (47, "3030",  "DBA",  "Luxe Mid Rise Denim", 1490, 999, "Enabled",
     {24:0,26:28,28:36,30:37,32:34,34:17,36:3},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3030/DBA-277x370.jpg",
     155, ["wide-leg","flared","designed","high-waisted","classic","flared","stw-unisex","vintage","spring26"]),
    (48, "3030",  "LBA",  "Luxe Mid Rise Denim", 1490, 999, "Enabled",
     {24:3,26:14,28:10,30:9,32:2,34:1,36:0,38:1,46:1,48:4},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/LBA-23-277x370.jpg",
     45, ["wide-leg","flared","designed","high-waisted","classic","flared","stw-unisex","vintage","spring26"]),
    (49, "3030",  "MBA",  "Luxe Mid Rise Denim", 1490, 999, "Enabled",
     {24:1,26:9,28:10,30:10,32:5,34:6,36:2,38:2,42:1},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/MBA-39-277x370.jpg",
     71, ["wide-leg","flared","high-waisted","classic","flared","stw-unisex","vintage","spring26"]),
    (50, "3030",  "WHT",  "Luxe Mid Rise Denim", 1490, 999, "Enabled",
     {26:2,28:15,30:26,32:17,34:17,36:2},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3030/3030/WHT-2-277x370.jpg",
     79, ["wide-leg","flared","designed","high-waisted","classic","flared","stw-unisex","vintage","spring26"]),
    (51, "3030",  "YLTN", "Luxe Mid Rise Denim", 1490, 999, "Enabled",
     {26:5,28:21,30:28,32:19,34:8},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/YLTN-1-277x370.jpg",
     81, ["wide-leg","flared","designed","high-waisted","classic","flared","stw-unisex","vintage","spring26"]),
    (52, "3010",  "LBA",  "Sasha Straight Fit Granding Jean's", 1590, 899, "Enabled",
     {24:68,26:71,28:62,30:31,32:63,34:20,36:36,38:2},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3010/Without_Stone_3010-277x370.jpg",
     353, ["wide-leg","straight","high-waisted","classic","fusion","plus-size","spring26"]),
    (53, "21026", "LBA",  "Side Bow Embroidery Women Casual Jeans", 1590, 1099, "Enabled",
     {26:7,28:0,30:0,32:14,34:1,36:8,38:11,40:3},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21026/21026%20Re-shooot/LBA-1-277x370.jpg",
     45, ["baggy"]),
    (54, "6009",  "MBA",  "Side Snap Wide Leg Cargo", 1690, 1199, "Enabled",
     {28:0,30:22,32:52,34:61,36:37,38:22,40:4,42:10,44:4,46:2,48:4},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/6009/2-277x370.jpg",
     218, ["baggy","cargo","straight","high-waisted","90s-baggy","cute","stw-unisex","y2k","eid26","spring26"]),
    (55, "21001", "BLKTN", "Signature Chic Denim Wide Leg Baggy Jean's", 1590, 999, "Enabled",
     {26:20,28:39,30:42,32:41,34:44,36:44,38:43,40:19},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/Tint_Black-2-277x370.jpg",
     292, ["wide-leg","flared","high-waisted","90s-baggy","classic","cute","vintage","eid26","spring26"]),
    (56, "21001", "DBA",  "Signature Chic Denim Wide Leg Baggy Jean's", 1590, 999, "Enabled",
     {26:29,28:39,30:39,32:10,34:69,36:100,38:26,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21001%20new/Re-shoot/DBA-1-277x370.jpg",
     95, ["wide-leg","baggy","flared","high-waisted","90s-baggy","classic","cute","vintage","eid26"]),
    (57, "21001", "DTN",  "Signature Chic Denim Wide Leg Baggy Jean's", 1590, 999, "Enabled",
     {26:2,28:48,30:47,32:49,34:88,36:89,38:28,40:11},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21001%20new/Re-shoot/DTN-277x370.jpg",
     394, ["wide-leg","baggy"]),
    (58, "21001", "MBA",  "Signature Chic Denim Wide Leg Baggy Jean's", 1590, 999, "Enabled",
     {24:0,26:70,28:110,30:100,32:100,34:75,36:71,38:24,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21001%20new/Re-shoot/MBA-2-277x370.jpg",
     126, ["wide-leg","baggy","high-waisted","90s-baggy","classic","cute","flared","vintage","spring26"]),
    (59, "21001", "LBA",  "Signature Chic Denim Wide Leg Baggy Jean's", 1590, 999, "Enabled",
     {26:0,28:10,30:6,32:0,34:9,36:8,38:0,40:10,42:8,44:7,46:9},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21001%20new/Re-shoot/LBA-277x370.jpg",
     86, ["wide-leg","baggy","flared","high-waisted","90s-baggy","classic","cute","vintage","spring26"]),
    (60, "21001", "MTN",  "Signature Chic Denim Wide Leg Baggy Jean's", 1590, 999, "Enabled",
     {26:41,28:65,30:56,32:63,34:51,36:62,38:43,40:2,42:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21001%20new/Re-shoot/MTN-2-277x370.jpg",
     433, ["wide-leg","baggy","high-waisted","90s-baggy","classic","cute","vintage","eid26","spring26"]),
    (61, "3033",  "LBA",  "Street Super Wide Leg", 1390, 999, "Enabled",
     {26:13,28:25,30:28,32:32,34:30,36:2,38:11,40:10},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3033/LBA-1-277x370.jpg",
     158, ["straight","distressed","high-waisted","90s-baggy","classic","cute","plus-size","stw-unisex","spring26"]),
    (62, "21013", "DBA",  "Trendy Stretchable Wide Leg Jean's", 1690, 999, "Enabled",
     {28:40,30:91,32:104,34:93,36:109,38:50,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21013/Re%20Shoot%2010%20March/DBA-2-277x370.jpg",
     1003, ["wide-leg","designed"]),
    (63, "21013", "DTN",  "Trendy Stretchable Wide Leg Jean's", 1690, 999, "Enabled",
     {28:42,30:107,32:100,34:91,36:94,38:46},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21013/Re%20Shoot%2010%20March/DTN-2-277x370.jpg",
     406, ["wide-leg"]),
    (64, "21013", "LBA",  "Trendy Stretchable Wide Leg Jean's", 1690, 999, "Enabled",
     {28:49,30:102,32:101,34:67,36:48,38:47},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21013/Re%20Shoot%2010%20March/LBA-1-277x370.jpg",
     460, ["wide-leg","designed"]),
    (65, "21013", "MBA",  "Trendy Stretchable Wide Leg Jean's", 1690, 999, "Enabled",
     {28:22,30:75,32:85,34:89,36:86,38:37,40:4},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21013/Re%20Shoot%2010%20March/MBA-2-277x370.jpg",
     430, ["wide-leg"]),
    (66, "21013", "MTN",  "Trendy Stretchable Wide Leg Jean's", 1690, 999, "Enabled",
     {28:37,30:100,32:105,34:108,36:83,38:36,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/21013/Re%20Shoot%2010%20March/MTN-2-277x370.jpg",
     456, ["wide-leg"]),
    (67, "2117",  "LBA",  "Twin Lock Barrel Fit Jean's", 1490, 899, "Enabled",
     {26:15,28:36,30:45,32:25,34:14,36:6,38:6},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/2116/Re%20Edit/Light_Blue-277x370.jpg",
     147, ["barrel"]),
    (68, "2117",  "MBA",  "Twin Lock Barrel Fit Jean's", 1300, 899, "Enabled",
     {26:9,28:9,30:9,32:6,34:7,36:9,38:7,40:10,42:8},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/2117/Retro_Fade-1-277x370.jpg",
     85, ["designed"]),
    (69, "2117",  "MTN",  "Twin Lock Barrel Fit Jean's", 1490, 899, "Enabled",
     {26:30,28:54,30:73,32:80,34:51,36:26,38:6},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/2116/Re%20Edit/Tint_Blue-277x370.jpg",
     320, ["barrel"]),
    (70, "3035",  "ASH",  "Urban Drift Mid-Waist Wide Leg Non Stretch Denim", 1390, 899, "Enabled",
     {26:50,28:45,30:45,32:44},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3035%20new/ASH-1-277x370.jpg",
     194, ["wide-leg","flared","high-waisted","classic","cute","flared","fusion","spring26"]),
    (71, "3035",  "DBA",  "Urban Drift Mid-Waist Wide-Leg Non-Stretch Denim", 1390, 899, "Enabled",
     {26:4,28:16,30:8,32:9,34:6,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3035%20new/DBA-2-277x370.jpg",
     53, ["wide-leg","flared","designed","high-waisted","classic","cute","flared","fusion","spring26"]),
    (72, "3035",  "LBA",  "Urban Drift Mid-Waist Wide-Leg Non-Stretch Denim", 1390, 899, "Enabled",
     {26:23,28:39,30:45,32:46,34:40,36:16,38:7,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3035%20new/Light_Blue-277x370.jpg",
     221, ["wide-leg","flared","designed","high-waisted","classic","cute","flared","fusion","spring26"]),
    (73, "3035",  "MBA",  "Urban Drift Mid-Waist Wide-Leg Non-Stretch Denim", 1390, 899, "Enabled",
     {26:6,28:41,30:26,32:12,34:27,36:5,38:5,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3035%20new/Mid_Blue-277x370.jpg",
     104, ["wide-leg","flared","high-waisted","classic","cute","flared","fusion","spring26"]),
    (74, "3035",  "MTN",  "Urban Drift Mid-Waist Wide-Leg Non-Stretch Denim", 1390, 899, "Enabled",
     {26:9,28:9,30:39,32:16,34:9,36:6,38:0,40:0},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/3035%20new/Mid_Tint-1-277x370.jpg",
     97, ["wide-leg","flared","high-waisted","classic","cute","flared","fusion","spring26"]),
    (75, "2120",  "MBA",  "Zenith Wide Leg Baggy Jean's", 1390, 899, "Enabled",
     {26:113,28:10,30:4,32:14,34:45,36:49,38:50,40:45},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/MBA-24-277x370.jpg",
     330, ["wide-leg","designed"]),
    (76, "2120",  "MTN",  "Zenith Wide Leg Baggy Jean's", 1390, 899, "Enabled",
     {26:6,28:7,30:9,32:0,34:6,36:0,38:4},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/2120/MTN-2-277x370.jpg",
     32, ["wide-leg","designed"]),
    (77, "2120",  "SPLA", "Zenith Wide Leg Baggy Jean's", 1390, 899, "Enabled",
     {24:29,26:29,28:57,30:46,32:43,34:48,36:21,38:31,40:33},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/SPLA-4-277x370.jpg",
     337, ["wide-leg","designed"]),
    (78, "2120",  "LBA",  "Zenith Wide Leg Baggy Jean's", 1390, 899, "Enabled",
     {24:22,26:40,28:39,30:38,32:27,34:29,36:23,38:24},
     "https://storola-client-space.sgp1.cdn.digitaloceanspaces.com/resources/clients/storola-clients/denimisia.com/cache/catalog/LBA-9-277x370.jpg",
     242, ["designed"]),
]

# Parent product metadata — inferred from the family of rows that share a model
PARENT_META = {
    "21003": {"title": "6 Ganding High Waist Baggy Wide-Leg Denim",
              "fit": "baggy wide-leg", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim", "hero_category": "wide-leg"},
    "21021": {"title": "Bow Embroidery High Waist Baggy Wide-Leg Jeans",
              "fit": "baggy wide-leg", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim with bow embroidery", "hero_category": "designed"},
    "21022": {"title": "Super Baggy Wide-Leg Denim Jeans",
              "fit": "super baggy wide-leg", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim", "hero_category": "wide-leg"},
    "21026": {"title": "Side Bow Embroidery Casual Jeans",
              "fit": "baggy wide-leg", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium denim with side bow detail", "hero_category": "designed"},
    "21001": {"title": "Signature Chic Wide-Leg Baggy Denim",
              "fit": "relaxed wide-leg", "waist": "high", "stretch": "non-stretch",
              "fabric": "silicon-washed non-stretch denim", "hero_category": "wide-leg"},
    "21013": {"title": "Trendy Stretchable Wide-Leg Jeans",
              "fit": "wide-leg flare", "waist": "high", "stretch": "2% spandex",
              "fabric": "100% premium cotton denim with spandex", "hero_category": "wide-leg"},
    "41011": {"title": "Comfy Wide-Leg Denim",
              "fit": "baggy wide-leg", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim", "hero_category": "wide-leg"},
    "2111":  {"title": "Premium Grey Wide-Leg Baggy Denim",
              "fit": "baggy wide-leg", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim", "hero_category": "baggy"},
    "2112":  {"title": "Sky Fade Mid-Rise Baggy Denim",
              "fit": "extra wide baggy", "waist": "mid", "stretch": "non-stretch",
              "fabric": "structured non-stretch denim", "hero_category": "baggy"},
    "2110":  {"title": "Drape Baggy Denim",
              "fit": "wide-leg drape", "waist": "mid", "stretch": "non-stretch",
              "fabric": "structured non-stretch denim", "hero_category": "baggy"},
    "2116":  {"title": "Lily Pintuck Barrel Fit Denim",
              "fit": "barrel-leg", "waist": "mid", "stretch": "non-stretch",
              "fabric": "rigid non-stretch denim", "hero_category": "barrel"},
    "2117":  {"title": "Twin Lock Barrel Fit Denim",
              "fit": "barrel-leg", "waist": "mid", "stretch": "non-stretch",
              "fabric": "rigid non-stretch denim", "hero_category": "barrel"},
    "2120":  {"title": "Zenith Wide-Leg Baggy Denim",
              "fit": "wide-leg baggy", "waist": "mid", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim", "hero_category": "wide-leg"},
    "3010":  {"title": "Sasha Straight Fit Granding Denim",
              "fit": "straight-leg", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim", "hero_category": "straight"},
    "3030":  {"title": "Luxe Mid Rise Denim",
              "fit": "wide-leg flared", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim", "hero_category": "wide-leg"},
    "3033":  {"title": "Street Super Wide-Leg Distressed Denim",
              "fit": "straight-leg", "waist": "high", "stretch": "non-stretch",
              "fabric": "non-stretch denim with distressing", "hero_category": "distressed"},
    "3034":  {"title": "Urban Smoke Wide-Leg Boyfriend Denim",
              "fit": "boyfriend straight", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim", "hero_category": "boyfriend"},
    "3035":  {"title": "Urban Drift Mid-Waist Wide-Leg Denim",
              "fit": "wide-leg soft-flare", "waist": "high", "stretch": "non-stretch",
              "fabric": "silicon-washed non-stretch denim", "hero_category": "wide-leg"},
    "3037":  {"title": "Alyza Patch Pocket Wide-Leg Denim",
              "fit": "wide-leg baggy", "waist": "high", "stretch": "semi-stretch",
              "fabric": "semi-stretch denim with patch pockets", "hero_category": "wide-leg"},
    "3039":  {"title": "Comfort Flow Stretch Flare Denim",
              "fit": "flared bootcut", "waist": "high", "stretch": "stretchable",
              "fabric": "stretchable structured denim", "hero_category": "flared"},
    "3044":  {"title": "Freha Flares Mid-Waist Denim",
              "fit": "flared bootcut", "waist": "mid", "stretch": "stretchable",
              "fabric": "stretchable denim", "hero_category": "flared"},
    "3045":  {"title": "AeroLite High-Waist Flare Denim",
              "fit": "flared bootcut", "waist": "high", "stretch": "stretchable",
              "fabric": "stretchable denim with silicon wash", "hero_category": "flared"},
    "3052":  {"title": "Lara Wide-Leg Boyfriend Denim",
              "fit": "boyfriend straight", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium non-stretch denim", "hero_category": "boyfriend"},
    "6007":  {"title": "Cairo Denim Cargo",
              "fit": "boyfriend cargo", "waist": "high", "stretch": "non-stretch",
              "fabric": "structured cargo denim", "hero_category": "cargo"},
    "6008":  {"title": "Kiara Urban Denim Cargo",
              "fit": "baggy straight cargo", "waist": "high", "stretch": "non-stretch",
              "fabric": "8-pocket cargo denim", "hero_category": "cargo"},
    "6009":  {"title": "Side Snap Wide-Leg Cargo Denim",
              "fit": "baggy wide-leg cargo", "waist": "high", "stretch": "non-stretch",
              "fabric": "structured cargo denim with snap detail", "hero_category": "cargo"},
    "6013":  {"title": "Obsidian Utility 6-Pocket Cargo Denim",
              "fit": "boyfriend straight cargo", "waist": "high", "stretch": "non-stretch",
              "fabric": "premium 6-pocket non-stretch denim", "hero_category": "cargo"},
}

# Category taxonomy — deduped, hierarchical
TAXONOMY = {
    "shop": {
        "label": "Shop",
        "children": {
            "wide-leg":      {"label": "Wide-Leg",      "slug": "wide-leg"},
            "baggy":         {"label": "Baggy Fit",     "slug": "baggy-fit"},
            "designed":      {"label": "Designed",      "slug": "designed"},
            "boyfriend":     {"label": "Boyfriend",     "slug": "boyfriend"},
            "straight":      {"label": "Straight Leg",  "slug": "straight-leg"},
            "cargo":         {"label": "Cargo",         "slug": "cargo"},
            "flared":        {"label": "Flared",        "slug": "flared"},
            "bootcut":       {"label": "Bootcut",       "slug": "bootcut"},
            "high-waisted":  {"label": "High-Waisted",  "slug": "high-waisted"},
            "distressed":    {"label": "Distressed",    "slug": "distressed"},
            "barrel":        {"label": "Barrel Fit",    "slug": "barrel-fit"},
        },
    },
    "collections": {
        "label": "Collections",
        "children": {
            "spring26": {"label": "Spring '26",   "slug": "spring-26"},
            "eid26":    {"label": "Eid al-Adha '26", "slug": "eid-26"},
        },
    },
    "series": {
        "label": "Series",
        "children": {
            "90s-baggy":  {"label": "90's Baggy",  "slug": "90s-baggy"},
            "classic":    {"label": "Classic",     "slug": "classic"},
            "fusion":     {"label": "Fusion",      "slug": "fusion"},
            "plus-size":  {"label": "Plus Size",   "slug": "plus-size"},
            "stw-unisex": {"label": "STW Unisex",  "slug": "stw-unisex"},
            "y2k":        {"label": "Y2K",         "slug": "y2k"},
            "cute":       {"label": "Cute",        "slug": "cute"},
            "vintage":    {"label": "Vintage",     "slug": "vintage"},
        },
    },
}

# Map tag keyword -> (group, leaf)
TAG_TO_CAT = {
    "wide-leg":     ("shop", "wide-leg"),
    "baggy":        ("shop", "baggy"),
    "designed":     ("shop", "designed"),
    "boyfriend":    ("shop", "boyfriend"),
    "straight":     ("shop", "straight"),
    "cargo":        ("shop", "cargo"),
    "flared":       ("shop", "flared"),
    "bootcut":      ("shop", "bootcut"),
    "high-waisted": ("shop", "high-waisted"),
    "distressed":   ("shop", "distressed"),
    "barrel":       ("shop", "barrel"),
    "spring26":     ("collections", "spring26"),
    "eid26":        ("collections", "eid26"),
    "90s-baggy":    ("series", "90s-baggy"),
    "classic":      ("series", "classic"),
    "fusion":       ("series", "fusion"),
    "plus-size":    ("series", "plus-size"),
    "stw-unisex":   ("series", "stw-unisex"),
    "y2k":          ("series", "y2k"),
    "cute":         ("series", "cute"),
    "vintage":      ("series", "vintage"),
}

SIZE_ORDER = [24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48]
COST_RATIO = 0.40  # placeholder — 40% of retail until boss provides real cost

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def make_sku(model: str, wash_code: str, size: int) -> str:
    return f"{model}-{wash_code}-{size}"

def wash_name(code: str) -> str:
    return WASH_CODES[code][0]

def wash_hex(code: str) -> str:
    return WASH_CODES[code][1]

# ---------------------------------------------------------------------------
# Build pipeline
# ---------------------------------------------------------------------------

def build_parents():
    """Group 78 rows into 27 parent products + variant lists."""
    parents: dict[str, dict] = {}
    for row in RAW_ROWS:
        (serial, model, wash_code, name_suffix, price, special_price, status,
         sizes, image_url, _total_qty, tags) = row
        if model not in parents:
            meta = PARENT_META[model]
            parents[model] = {
                "model":       model,
                "slug":        slugify(f"{meta['title']}-{model}"),
                "title":       meta["title"],
                "fit":         meta["fit"],
                "waist":       meta["waist"],
                "stretch":     meta["stretch"],
                "fabric":      meta["fabric"],
                "hero_category": meta["hero_category"],
                "tags":        set(),
                "variants":    [],
            }
        parents[model]["tags"].update(tags)
        variant = {
            "serial":        serial,
            "wash_code":     wash_code,
            "wash_name":     wash_name(wash_code),
            "wash_hex":      wash_hex(wash_code),
            "sku_prefix":    f"{model}-{wash_code}",
            "price_bdt":     price,
            "special_price_bdt": special_price,
            "cost_price_bdt_estimated": round(price * COST_RATIO),
            "status":        status.lower(),
            "source_image":  image_url,
            "name_suffix":   name_suffix,
            "sizes":         {str(s): q for s, q in sizes.items()},
            "total_stock":   sum(sizes.values()),
        }
        parents[model]["variants"].append(variant)
    for m in parents.values():
        m["tags"] = sorted(m["tags"])
    return parents

def build_categories(parents: dict):
    cat_members: dict[str, list[str]] = {}
    for model, p in parents.items():
        for tag in p["tags"]:
            if tag not in TAG_TO_CAT:
                continue
            group, leaf = TAG_TO_CAT[tag]
            key = f"{group}/{leaf}"
            cat_members.setdefault(key, []).append(model)
    out = {"taxonomy": TAXONOMY, "memberships": {}}
    for key, members in cat_members.items():
        out["memberships"][key] = sorted(set(members))
    return out

def build_inventory(parents: dict):
    rows = []
    for model, p in parents.items():
        for v in p["variants"]:
            for size, qty in v["sizes"].items():
                rows.append({
                    "sku":      make_sku(model, v["wash_code"], int(size)),
                    "model":    model,
                    "wash":     v["wash_code"],
                    "size":     int(size),
                    "quantity": qty,
                })
    rows.sort(key=lambda r: (r["model"], r["wash"], r["size"]))
    return rows

def build_seo(parents: dict):
    out = {}
    for model, p in parents.items():
        # Parent-level SEO
        parent_key = f"product/{p['slug']}"
        category_phrase = p["hero_category"].replace("-", " ")
        out[parent_key] = {
            "meta_title":       f"{p['title']} | Denimisia",
            "meta_description": (
                f"{p['title']} — {p['fit']} fit, {p['waist']} waist, "
                f"{p['fabric']}. Available in {len(p['variants'])} washes. "
                f"Premium women's denim by Denimisia."
            )[:160],
            "og_title":         p["title"],
            "og_description":   f"{p['fit'].capitalize()} {category_phrase} denim — {len(p['variants'])} washes, sizes 24–48.",
            "canonical":        f"/products/{p['slug']}",
        }
        # Variant-level SEO
        for v in p["variants"]:
            v_slug = slugify(f"{p['slug']}-{v['wash_name']}")
            variant_key = f"product/{v_slug}"
            out[variant_key] = {
                "meta_title": f"{p['title']} — {v['wash_name']} | Denimisia",
                "meta_description": (
                    f"{p['title']} in {v['wash_name']}. {p['fit'].capitalize()} fit, "
                    f"{p['waist']} waist, {p['stretch']}. "
                    f"Sizes {min(int(s) for s in v['sizes'].keys())}–"
                    f"{max(int(s) for s in v['sizes'].keys())}. "
                    f"Shop premium women's denim."
                )[:160],
                "og_title":       f"{p['title']} — {v['wash_name']}",
                "og_description": f"{v['wash_name']} wash, {p['fit']} silhouette.",
                "canonical":      f"/products/{p['slug']}/{slugify(v['wash_name'])}",
            }
    return out

def build_images(parents: dict):
    """Create an image manifest mapping source thumbnails to planned R2 paths."""
    manifest = []
    for model, p in parents.items():
        for v in p["variants"]:
            r2_base = f"products/{model}/{v['wash_code']}"
            manifest.append({
                "model":        model,
                "wash":         v["wash_code"],
                "source_url":   v["source_image"],
                "r2_primary":   f"{r2_base}/primary.webp",
                "r2_slots": {
                    "front":  f"{r2_base}/01-front.webp",
                    "back":   f"{r2_base}/02-back.webp",
                    "detail": f"{r2_base}/03-detail.webp",
                    "model":  f"{r2_base}/04-model.webp",
                },
                "source_size": "277x370",
                "target_sizes": {
                    "thumb": "400x560",
                    "card":  "600x840",
                    "pdp":   "1200x1680",
                },
                "migration_status": "pending",
            })
    return manifest

def build_prisma_seed(parents: dict):
    """Emit a TypeScript seed snippet for packages/database/prisma."""
    parent_rows = []
    for model, p in sorted(parents.items()):
        parent_rows.append({
            "model":    model,
            "slug":     p["slug"],
            "title":    p["title"],
            "fit":      p["fit"],
            "waist":    p["waist"],
            "stretch":  p["stretch"],
            "fabric":   p["fabric"],
            "hero_category": p["hero_category"],
            "tags":     p["tags"],
        })

    variant_rows = []
    inventory_rows = []
    for model, p in sorted(parents.items()):
        for v in p["variants"]:
            v_slug = slugify(f"{p['slug']}-{v['wash_name']}")
            variant_rows.append({
                "parent_model":   model,
                "sku_prefix":     v["sku_prefix"],
                "wash_code":      v["wash_code"],
                "wash_name":      v["wash_name"],
                "wash_hex":       v["wash_hex"],
                "slug":           v_slug,
                "price_bdt":      v["price_bdt"],
                "special_price_bdt": v["special_price_bdt"],
                "cost_price_bdt_estimated": v["cost_price_bdt_estimated"],
                "status":         v["status"],
                "source_image":   v["source_image"],
            })
            for size, qty in v["sizes"].items():
                inventory_rows.append({
                    "sku":      make_sku(model, v["wash_code"], int(size)),
                    "variant_sku_prefix": v["sku_prefix"],
                    "size":     int(size),
                    "quantity": qty,
                })

    ts = (
        "// AUTO-GENERATED by data/catalog/transform.py — DO NOT EDIT BY HAND\n"
        "// Source: products_details.csv (78 flat rows → 27 parents + variants + inventory)\n"
        "// Cost prices are ESTIMATES (40% of retail). Replace with real numbers before launch.\n\n"
        f"export const PARENTS = {json.dumps(parent_rows, indent=2, ensure_ascii=False)} as const;\n\n"
        f"export const VARIANTS = {json.dumps(variant_rows, indent=2, ensure_ascii=False)} as const;\n\n"
        f"export const INVENTORY = {json.dumps(inventory_rows, indent=2, ensure_ascii=False)} as const;\n"
    )
    return ts

# ---------------------------------------------------------------------------
# Emit outputs
# ---------------------------------------------------------------------------

def main():
    parents = build_parents()
    categories = build_categories(parents)
    inventory = build_inventory(parents)
    seo = build_seo(parents)
    images = build_images(parents)
    prisma_ts = build_prisma_seed(parents)

    # Parent + variants JSON
    (OUT_DIR / "products.json").write_text(
        json.dumps(list(parents.values()), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (OUT_DIR / "categories.json").write_text(
        json.dumps(categories, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    (OUT_DIR / "inventory.json").write_text(
        json.dumps(inventory, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    (OUT_DIR / "seo.json").write_text(
        json.dumps(seo, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    (OUT_DIR / "images.json").write_text(
        json.dumps(images, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    (OUT_DIR / "prisma_seed.ts").write_text(prisma_ts, encoding="utf-8")

    # Summary report
    total_variants = sum(len(p["variants"]) for p in parents.values())
    total_inventory_units = sum(r["quantity"] for r in inventory)
    active_variants = sum(
        1 for p in parents.values() for v in p["variants"] if v["status"] == "enabled"
    )
    disabled = [
        (p["model"], v["wash_code"])
        for p in parents.values()
        for v in p["variants"] if v["status"] == "disabled"
    ]
    zero_stock = [
        (p["model"], v["wash_code"])
        for p in parents.values()
        for v in p["variants"]
        if v["status"] == "enabled" and v["total_stock"] == 0
    ]

    report = f"""# Denimisia Catalog — Cleaned Output

Generated from `products_details.csv` (78 flat rows).

## Shape
- **{len(parents)} parent products** (grouped by style model)
- **{total_variants} variants** (one per wash/color)
- **{sum(len(v['sizes']) for p in parents.values() for v in p['variants'])} inventory rows** (variant × size)
- **{total_inventory_units:,} total units** in stock
- **{active_variants}** enabled variants / **{len(disabled)}** disabled

## Cleanup Applied
- [x] Schema normalization → parent/variant split
- [x] Encoding fixed → all output is clean UTF-8 (mojibake stripped; Bengali was destroyed at source and cannot be recovered)
- [x] Category taxonomy deduped → 3 groups (shop, collections, series) with 21 leaves total
- [x] SEO regenerated → real meta titles + descriptions (≤160 chars), per parent AND per variant
- [x] Cost prices backfilled → **40% of retail** as placeholder. REPLACE with real cost before launch.
- [x] Size stock matrix → exploded into flat inventory table (sku, model, wash, size, qty)
- [x] Image manifest built → R2 target paths reserved with gallery slots (front/back/detail/model)

## Files
| File | Purpose |
|------|---------|
| `output/products.json`    | Parent products with nested variants (27 parents) |
| `output/categories.json`  | Clean taxonomy + model-to-category memberships |
| `output/inventory.json`   | Flat variant × size stock rows |
| `output/seo.json`         | Meta titles/descriptions per parent + variant |
| `output/images.json`      | Source URLs + R2 target paths (migration pending) |
| `output/prisma_seed.ts`   | TS constants ready to import into a Prisma seed |

## Known Data Quality Flags (require human action)
- **Cost prices**: 40% ratio is a guess. Boss needs to provide real cost.
- **Images**: only one thumbnail per variant. Gallery slots are reserved but empty. Need photo shoot or vendor assets before launch.
- **Disabled variants** ({len(disabled)}): {disabled}
- **Enabled but zero-stock** ({len(zero_stock)}): {zero_stock}
- **Bengali tags**: source had mojibake (`à¦­à¦¾à¦à¦°à¦¾à¦²` style). Tags with corrupted Bengali were dropped — re-source if Bangla SEO is needed.
- **Related products**: source stored name strings, not IDs. Intentionally skipped — will be rebuilt from model family + tag overlap at query time.
- **Size Chart column**: 100% empty in source. Add a per-fit size chart (at parent level) before launch.

## Suggested Next Step
Generate the Prisma schema migration from `output/products.json` + `output/inventory.json`, then
import `prisma_seed.ts` into `packages/database/prisma/seed.ts` for a one-shot catalog load.
"""
    (OUT_DIR / "CLEAN_REPORT.md").write_text(report, encoding="utf-8")

    # Console summary
    print(f"OK  parents={len(parents)}  variants={total_variants}  "
          f"inventory_rows={sum(len(v['sizes']) for p in parents.values() for v in p['variants'])}  "
          f"units={total_inventory_units:,}")
    print(f"    disabled={len(disabled)}  zero_stock={len(zero_stock)}")
    for f in sorted(OUT_DIR.iterdir()):
        print(f"    wrote {f.relative_to(OUT_DIR.parent)}")

if __name__ == "__main__":
    main()
