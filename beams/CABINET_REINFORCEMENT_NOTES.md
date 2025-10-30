Cabinet – Reinforcement Outside: Implementation Notes

Scope: Applies only when the parameter `is-reinforcement-beams-outside` is true. Otherwise, no visual/price changes occur. Logs remain regardless.

3D changes (cabinet only, flag = true)
- Legs (Z axis only):
  - Move each leg toward Z=0 by b, where b = leg profile height in cm (legBeam.height / 10).
  - Only Z changes; no Y/X movement.

- Frame beams under each shelf (the rectangular frame between legs):
  - X‑spanning pair (width direction): extend the beam width by 2a (a = leg profile width in cm, legBeam.width / 10). Position remains centered.
  - Z‑spanning pair (length direction): shorten the beam depth by 2b (b = leg profile height in cm). Position remains centered.

Pricing data changes (cabinet only, flag = true)
- The quantities/lengths sent to pricing mirror the 3D adjustments:
  - X‑spanning frame beams per shelf are reported with length = surfaceWidth + 2a.
  - Z‑spanning frame beams per shelf are reported with length = surfaceLength − 2b.

Notes
- a = leg profile width (cm) = legBeam.width / 10.
- b = leg profile height (cm) = legBeam.height / 10.
- Adjustments are guarded to avoid negative/near‑zero dimensions.
- Table/futon remain unchanged by this flag at this stage (only logs exist there).


