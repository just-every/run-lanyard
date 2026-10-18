import { check, picture } from '../parts'

// 07 · The North Park bake room at 5:00 am Saturday, before the call-out.
export const interlude = () => `<section class="band band-art interlude" aria-label="Saturday, 5:00 am, North Park">${picture('bakeroom', [768, 1152, 1536], [1536, 1024], '100vw', 'Ink-and-watercolor sketch of a bakery’s bake room before dawn: three bakers at a floured bench, racks of conchas and bolillos, glowing deck ovens and a small kiosk on the far wall.', 'interlude-art')}<p class="scene-tag">Sat Oct 24 · 5:00 am · North Park · 3 of 3 bakers in ${check()}</p></section>`
