// Curated guide library.
//
// This is the "curated" half of the hybrid content model. Guides are plain
// data so they can later be moved to a database/CMS, and an AI provider can be
// added next to this one (see server/content/index.js) without touching the UI.

export const STYLES = [
  { id: 'realism', name: 'Realism', blurb: 'Paint what you see: accurate shapes, values and light.' },
  { id: 'impressionism', name: 'Impressionism', blurb: 'Capture light and atmosphere with visible, broken brushstrokes.' },
  { id: 'abstract', name: 'Abstract', blurb: 'Colour, shape and texture instead of recognisable subjects.' },
  { id: 'pop-art', name: 'Pop Art', blurb: 'Bold outlines, flat bright colours and everyday objects.' },
  { id: 'minimalism', name: 'Minimalism', blurb: 'Few elements, calm colour fields, lots of breathing space.' },
];

export const LEVELS = [
  { id: 'beginner', name: 'Beginner', blurb: 'New to painting or returning after a long break.' },
  { id: 'intermediate', name: 'Intermediate', blurb: 'Comfortable mixing colours and finishing simple paintings.' },
  { id: 'advanced', name: 'Advanced', blurb: 'Confident with technique; want a real challenge.' },
];

export const MEDIUMS = [
  { id: 'acrylic', name: 'Acrylic' },
  { id: 'watercolor', name: 'Watercolour' },
  { id: 'oil', name: 'Oil' },
  { id: 'gouache', name: 'Gouache' },
];

// Shared material bundles to keep lists consistent.
const ACRYLIC_BASICS = [
  'Acrylic paints: titanium white, mars black, cadmium yellow (hue), cadmium red (hue), ultramarine blue',
  'Synthetic brushes: 1 flat (2–3 cm), 1 medium filbert, 1 small round',
  'Palette (a plate or palette paper works)',
  'Two jars of water and paper towels',
  'Pencil or chalk for sketching',
];

const OIL_BASICS = [
  'Oil paints: titanium white, ivory black, cadmium yellow (hue), alizarin crimson (hue), ultramarine blue, yellow ochre, burnt umber',
  'Hog bristle brushes: flats and filberts in sizes 4, 8, 12',
  'Odourless mineral spirits for cleaning (work in a ventilated room)',
  'Palette knife and palette',
  'Rags or paper towels',
];

const WATERCOLOR_BASICS = [
  'Watercolour paints: a starter set with at least yellow, red, blue, burnt sienna',
  'Round brushes: sizes 4 and 10; one flat wash brush',
  'Palette with mixing wells',
  'Masking tape to fix the paper edges',
  'Two jars of water and paper towels',
];

const GOUACHE_BASICS = [
  'Gouache: white, black, primary yellow, primary red, primary blue (plus any bright extras you like)',
  'Synthetic brushes: small flat and small round',
  'Palette with wells, water jar, paper towels',
  'Pencil and eraser',
];

export const GUIDES = [
  // ---------- Realism ----------
  {
    id: 'realism-beginner-apple',
    title: 'A single apple on a table',
    style: 'realism', level: 'beginner', medium: 'acrylic',
    durationMinutes: 90,
    canvas: '20 × 25 cm stretched canvas or canvas board',
    summary: 'Learn to see light and shadow on one simple rounded object.',
    materials: [...ACRYLIC_BASICS, 'Canvas board 20 × 25 cm', 'One real apple and a desk lamp'],
    steps: [
      { title: 'Set up your subject', text: 'Put the apple on a plain surface. Light it from one side with a lamp so there is a clear bright side, a shadow side and a cast shadow on the table.' },
      { title: 'Tone the canvas', text: 'Mix a little yellow and black with lots of water-thinned white to a mid grey-beige. Cover the whole canvas thinly and let it dry (10 minutes).' },
      { title: 'Sketch the shapes', text: 'Lightly draw a circle slightly flattened at the top, the stem, and the cast shadow shape. Keep it simple; you will correct with paint.' },
      { title: 'Block in the darks', text: 'Mix red with a touch of blue for the shadow side of the apple. Paint the cast shadow with a dark mix of blue, red and a little yellow.' },
      { title: 'Paint the mid-tones', text: 'Use pure red (with a touch of yellow if your apple is warm) for the part turning toward the light. Blend where it meets the shadow while both are wet.' },
      { title: 'Add the background and table', text: 'Paint the table and background in muted colours so the apple stands out. Cut back into the apple edge to clean its outline.' },
      { title: 'Highlights and stem', text: 'Add a small, almost white highlight where the lamp hits the apple. Paint the stem with a thin dark brown line. Stop here: less is more.' },
    ],
    tips: ['Squint at the apple to see the big light and dark shapes.', 'Acrylic dries fast: mix enough colour and keep a spray bottle nearby.'],
  },
  {
    id: 'realism-intermediate-cup',
    title: 'Coffee cup still life',
    style: 'realism', level: 'intermediate', medium: 'acrylic',
    durationMinutes: 180,
    canvas: '30 × 40 cm stretched canvas',
    summary: 'Practise ellipses, reflected light and a believable ceramic surface.',
    materials: [...ACRYLIC_BASICS, 'Burnt umber and yellow ochre', 'Stretched canvas 30 × 40 cm', 'A plain white cup and a single light source'],
    steps: [
      { title: 'Arrange and light', text: 'Place the cup slightly off-centre, handle to one side. Use one lamp. Take a reference photo too in case the light changes.' },
      { title: 'Draw with ellipses', text: 'Draw a vertical centre line, then the top and bottom ellipses. The bottom ellipse is rounder than the top one because you see more of it.' },
      { title: 'Underpainting', text: 'Paint all shadows in a thin burnt umber wash. This fixes the value structure before colour.' },
      { title: 'Background first', text: 'Paint the background and table so you can judge the white of the cup against its surroundings.' },
      { title: 'Model the cup', text: 'White cups are not white: mix the shadow side with white, a little blue and umber; the lit side with white and a hint of yellow. Blend the core shadow softly.' },
      { title: 'Reflected light', text: 'Look for a slightly lighter band inside the shadow side, reflected from the table. Add it subtly; it makes the cup feel round.' },
      { title: 'Coffee and details', text: 'Paint the coffee surface as a dark ellipse with a lighter rim reflection. Add the cast shadow and the handle shadow.' },
      { title: 'Final highlights', text: 'Add crisp highlights on the rim and body with pure white. Sharpen edges nearest to you; soften those further away.' },
    ],
    tips: ['Check the ellipse symmetry by turning the canvas upside down.', 'Keep the darkest darks in the coffee and the cast shadow only.'],
  },
  {
    id: 'realism-advanced-portrait',
    title: 'Portrait study from a photo',
    style: 'realism', level: 'advanced', medium: 'oil',
    durationMinutes: 480,
    canvas: '40 × 50 cm primed canvas',
    summary: 'A head-and-shoulders portrait focusing on proportion and skin tones.',
    materials: [...OIL_BASICS, 'Cadmium red light', 'Small round sable-type brush for details', 'Primed canvas 40 × 50 cm', 'Printed reference photo with clear side light'],
    steps: [
      { title: 'Choose the reference', text: 'Pick a photo with one strong light source and a simple background. Crop it to the same proportion as your canvas.' },
      { title: 'Proportion drawing', text: 'Mark top of head and chin. Eyes sit about halfway. Measure nose and mouth positions against the photo. Thin burnt umber with spirits and draw with a small brush.' },
      { title: 'Monochrome underpainting', text: 'Block in shadow shapes with burnt umber (the "brunaille"). Wipe out lights with a rag. Let it set for a few hours or overnight.' },
      { title: 'Mix a skin palette', text: 'Pre-mix three values: light (white + yellow ochre + a touch of red), middle (ochre + red + white), shadow (burnt umber + red + a touch of blue).' },
      { title: 'Block in colour', text: 'Paint large planes first: forehead, cheeks, nose, chin. Work "fat over lean": add a drop of oil medium only in later layers.' },
      { title: 'Turn the form', text: 'Blend transitions between planes. Look for cool (blue/green) half-tones around the mouth and jaw and warm reds at the ears, nose and cheeks.' },
      { title: 'Features', text: 'Paint eyes as shapes of light and dark, not outlines. The white of the eye is darker than you think. Keep lips soft at the corners.' },
      { title: 'Hair and background', text: 'Paint hair as big masses with a few strands on top. Adjust the background value to make the face read clearly.' },
      { title: 'Final accents', text: 'Add the brightest highlights (nose tip, eye catchlight) and darkest accents (nostrils, eye corners). Let the painting dry before varnishing (at least 6 months for oils).' },
    ],
    tips: ['Check proportions in a mirror: a fresh view shows errors fast.', 'Never use white alone for skin highlights; tint it.'],
  },

  // ---------- Impressionism ----------
  {
    id: 'impressionism-beginner-sunset',
    title: 'Sunset over a field',
    style: 'impressionism', level: 'beginner', medium: 'acrylic',
    durationMinutes: 75,
    canvas: '20 × 25 cm canvas board',
    summary: 'Loose, dabbed strokes to build a glowing sky and a simple field.',
    materials: [...ACRYLIC_BASICS, 'Canvas board 20 × 25 cm'],
    steps: [
      { title: 'Place the horizon', text: 'Draw a horizontal line about one third from the bottom. The sky gets two thirds of the painting.' },
      { title: 'Sky gradient', text: 'Starting at the top, paint bands: blue + white, then pink (red + white), then orange, then pale yellow near the horizon. Blend the bands slightly.' },
      { title: 'Sun glow', text: 'Dab a pale yellow-white circle just above the horizon. Surround it with short strokes of orange.' },
      { title: 'Dark field', text: 'Paint the field with a dark mix of blue, red and yellow. It should be darker than any part of the sky.' },
      { title: 'Broken colour strokes', text: 'With a small brush, add short strokes of green, purple and orange on the field, without blending. Let them sit next to each other.' },
      { title: 'Silhouettes', text: 'Add a tree or fence posts as dark silhouettes on the horizon. Stop while it still looks fresh.' },
    ],
    tips: ['Don\'t over-blend: visible strokes are the point of the style.', 'Look at Monet\'s "Impression, Sunrise" for inspiration.'],
  },
  {
    id: 'impressionism-intermediate-garden',
    title: 'Garden path with flowers',
    style: 'impressionism', level: 'intermediate', medium: 'oil',
    durationMinutes: 240,
    canvas: '30 × 40 cm canvas',
    summary: 'Dappled light, a receding path and colourful flower masses.',
    materials: [...OIL_BASICS, 'Permanent rose or magenta', 'Viridian or phthalo green', 'Canvas 30 × 40 cm'],
    steps: [
      { title: 'Composition', text: 'Sketch a path starting wide at the bottom and narrowing toward a point above centre. Mark flower masses on both sides.' },
      { title: 'Thin block-in', text: 'Cover the canvas with thin colour: greens for foliage, warm ochre for the path, a light sky. No detail yet.' },
      { title: 'Shadows across the path', text: 'Paint cool purple-blue shadows falling across the path. Leave warm sunlit patches between them.' },
      { title: 'Foliage masses', text: 'Build foliage with thicker dabs: dark blue-green in shade, yellow-green in light. Vary stroke direction.' },
      { title: 'Flowers', text: 'Add flowers as thick dabs of pure colour (rose, yellow, white). Keep them small and smaller again in the distance.' },
      { title: 'Atmospheric perspective', text: 'Make distant colours lighter, cooler and less saturated. This pushes the end of the path back.' },
      { title: 'Final highlights', text: 'Add a few thick, bright strokes where sunlight hits flowers and leaves. Use a clean brush for each colour.' },
    ],
    tips: ['Paint outdoors (en plein air) if you can: the light changes, so work fast.', 'Keep shadows colourful, never plain grey or black.'],
  },
  {
    id: 'impressionism-advanced-rainy-street',
    title: 'Rainy city street at dusk',
    style: 'impressionism', level: 'advanced', medium: 'oil',
    durationMinutes: 420,
    canvas: '40 × 60 cm canvas',
    summary: 'Wet reflections, glowing lights and figures suggested with a few strokes.',
    materials: [...OIL_BASICS, 'Cadmium orange', 'Payne\'s grey (optional)', 'Canvas 40 × 60 cm', 'Reference photo of a wet street at dusk'],
    steps: [
      { title: 'Perspective lines', text: 'Set a vanishing point on the horizon. Draw building edges and kerb lines converging toward it.' },
      { title: 'Dark toned ground', text: 'Cover the canvas in a thin blue-grey. Dusk scenes are built from dark to light.' },
      { title: 'Buildings as masses', text: 'Block buildings in cool darks with warmer windows. Don\'t paint bricks or details.' },
      { title: 'Lights', text: 'Add street lamps, windows and car lights with thick warm paint (yellow, orange, white).' },
      { title: 'Wet reflections', text: 'Drag vertical strokes down from each light into the street surface. Reflections sit directly below their source.' },
      { title: 'Figures', text: 'Suggest people with a dark vertical stroke, a small head, an umbrella shape. Make them smaller as they recede.' },
      { title: 'Unify', text: 'Glaze or scumble a thin cool layer over areas that jump out too much. Keep the brightest lights untouched.' },
      { title: 'Accents', text: 'Final touches: a few sparkles on the road, a red tail light, a crisp edge on the nearest figure.' },
    ],
    tips: ['Study Gustave Caillebotte\'s "Paris Street; Rainy Day" for composition.', 'Limit detail to the focal point.'],
  },

  // ---------- Abstract ----------
  {
    id: 'abstract-beginner-color-blocks',
    title: 'Colour blocks with tape',
    style: 'abstract', level: 'beginner', medium: 'acrylic',
    durationMinutes: 60,
    canvas: '30 × 30 cm canvas',
    summary: 'Crisp geometric shapes using painter\'s tape: impossible to get wrong.',
    materials: [...ACRYLIC_BASICS, 'Painter\'s (masking) tape, 1–2 cm wide', 'Canvas 30 × 30 cm'],
    steps: [
      { title: 'Pick a palette', text: 'Choose 3–4 colours that go together, for example two blues, an orange and white. Mix them before you start.' },
      { title: 'Tape the design', text: 'Stick tape across the canvas in straight lines that cross each other, creating 6–10 shapes. Press edges down firmly.' },
      { title: 'Fill the shapes', text: 'Paint each shape a single colour. Neighbouring shapes should differ. Two thin coats are better than one thick one.' },
      { title: 'Dry', text: 'Let it dry to the touch (about 20 minutes).' },
      { title: 'Peel the tape', text: 'Pull the tape slowly at a low angle. The white lines are part of the design.' },
      { title: 'Touch up', text: 'Fix any bleeds with a small brush and white paint.' },
    ],
    tips: ['Seal tape edges with a thin coat of the background colour first for razor-sharp lines.'],
  },
  {
    id: 'abstract-intermediate-knife',
    title: 'Textured palette-knife landscape',
    style: 'abstract', level: 'intermediate', medium: 'acrylic',
    durationMinutes: 150,
    canvas: '40 × 40 cm canvas',
    summary: 'A semi-abstract landscape built from thick knife layers and scraped texture.',
    materials: [...ACRYLIC_BASICS, 'Palette knives (a trowel shape and a small diamond shape)', 'Heavy-body acrylic or modelling paste', 'Old credit card for scraping', 'Canvas 40 × 40 cm'],
    steps: [
      { title: 'Warm underlayer', text: 'Cover the canvas with a thin, bright colour (orange or magenta). It will peek through later.' },
      { title: 'Horizontal bands', text: 'Using the knife, spread 3–5 horizontal bands of colour: sky, distant land, near land.' },
      { title: 'Texture', text: 'Add modelling paste mixed with paint in the foreground. Drag the knife to create ridges.' },
      { title: 'Scrape back', text: 'While wet, drag a credit card across some areas to reveal the underlayer.' },
      { title: 'Accent colour', text: 'Add one small area of a contrasting colour as the focal point, off-centre.' },
      { title: 'Evaluate', text: 'Step back 3 metres. If it feels busy, simplify an area with a single calm colour.' },
    ],
    tips: ['Clean the knife between colours to keep them fresh.', 'Thick paste needs several hours to dry fully.'],
  },
  {
    id: 'abstract-advanced-emotion',
    title: 'Expressive abstract from a feeling',
    style: 'abstract', level: 'advanced', medium: 'acrylic',
    durationMinutes: 300,
    canvas: '50 × 70 cm canvas',
    summary: 'Build a layered, non-representational painting around a single emotion.',
    materials: [...ACRYLIC_BASICS, 'Large house-painting brush (5 cm)', 'Oil pastels or charcoal', 'Acrylic glazing medium', 'Canvas 50 × 70 cm'],
    steps: [
      { title: 'Define the idea', text: 'Write one word for the feeling (e.g. "restless"). Decide what colours, temperatures and line types express it.' },
      { title: 'Gestural start', text: 'With the large brush, make fast, big marks covering the whole canvas. Do not judge yet.' },
      { title: 'Layer and cover', text: 'Cover 50–70% of the first layer with new colour. Leave the best accidents visible.' },
      { title: 'Line work', text: 'Draw into the wet or dry paint with charcoal or oil pastel: scribbles, lines, marks that match the feeling.' },
      { title: 'Glazes', text: 'Mix paint with glazing medium and apply transparent layers to unify colours and create depth.' },
      { title: 'Balance', text: 'Rotate the canvas 90° several times. Choose the orientation that works best and adjust the composition.' },
      { title: 'Know when to stop', text: 'Photograph the painting and look at it on your phone in black and white: it should have clear value contrast.' },
    ],
    tips: ['Look at Joan Mitchell and Helen Frankenthaler for inspiration.', 'Work on 2 paintings at once so you don\'t overwork one.'],
  },

  // ---------- Pop Art ----------
  {
    id: 'pop-art-beginner-fruit',
    title: 'Pop-art banana',
    style: 'pop-art', level: 'beginner', medium: 'gouache',
    durationMinutes: 60,
    canvas: 'A4 heavy mixed-media paper (250 g/m² or more)',
    summary: 'Flat bright colours and a thick black outline on one everyday object.',
    materials: [...GOUACHE_BASICS, 'Black fine-liner or black paint pen', 'A4 mixed-media paper'],
    steps: [
      { title: 'Draw large', text: 'Draw a banana big enough to almost touch the paper edges. Simplify the shape.' },
      { title: 'Bright background', text: 'Paint the background one flat, saturated colour (e.g. pink or cyan). Two coats for even coverage.' },
      { title: 'Flat object colour', text: 'Paint the banana flat yellow. Add one shadow shape in orange-yellow, no blending.' },
      { title: 'Outline', text: 'When dry, outline everything with a thick black line.' },
      { title: 'Ben-Day dots', text: 'Add a small area of dots (use a pencil eraser dipped in paint) in the shadow or background.' },
    ],
    tips: ['Gouache reactivates with water: paint the outline last and don\'t go over it wet.'],
  },
  {
    id: 'pop-art-intermediate-portrait',
    title: 'Four-colour pop portrait',
    style: 'pop-art', level: 'intermediate', medium: 'acrylic',
    durationMinutes: 180,
    canvas: '40 × 40 cm canvas',
    summary: 'A portrait reduced to 3 value shapes, painted in Warhol-style colours.',
    materials: [...ACRYLIC_BASICS, 'Fluorescent or bright acrylics (magenta, lime, turquoise)', 'Carbon/graphite transfer paper', 'Canvas 40 × 40 cm', 'Printed high-contrast photo'],
    steps: [
      { title: 'Posterise the photo', text: 'Use a free photo editor\'s "posterize" or "threshold" filter to reduce the photo to 3 tones: light, mid, dark.' },
      { title: 'Transfer', text: 'Print it at canvas size and trace the shape borders onto the canvas with transfer paper.' },
      { title: 'Background', text: 'Paint the background in one flat bright colour.' },
      { title: 'Light shapes', text: 'Fill the lightest shapes (skin highlights) with a pale bright colour.' },
      { title: 'Mid shapes', text: 'Fill mid-tone shapes with a contrasting bright colour.' },
      { title: 'Dark shapes', text: 'Fill dark shapes with black or a deep colour. Keep edges crisp.' },
      { title: 'Accent', text: 'Add one unexpected colour for lips or eyes.' },
    ],
    tips: ['Use a photo of yourself or someone who has given permission.', 'Paint 4 small versions in different colour schemes for a Warhol-style series.'],
  },
  {
    id: 'pop-art-advanced-comic',
    title: 'Comic-panel narrative painting',
    style: 'pop-art', level: 'advanced', medium: 'acrylic',
    durationMinutes: 360,
    canvas: '50 × 70 cm canvas',
    summary: 'A Lichtenstein-inspired comic panel with speech bubble and hand-painted dots.',
    materials: [...ACRYLIC_BASICS, 'Primary-colour acrylics (process cyan, magenta, yellow)', 'Stencil sheet and craft knife (for dots)', 'Black acrylic ink or paint pen', 'Canvas 50 × 70 cm'],
    steps: [
      { title: 'Storyboard', text: 'Sketch 3 thumbnail ideas of a dramatic moment with a character and a short speech bubble. Pick the strongest.' },
      { title: 'Final drawing', text: 'Draw the panel on the canvas with confident lines. Leave space for the bubble.' },
      { title: 'Make a dot stencil', text: 'Cut a grid of equal circles into a stencil sheet. Consistent dots sell the style.' },
      { title: 'Dot areas', text: 'Stencil dots for skin and shaded areas. Let them dry.' },
      { title: 'Flat colours', text: 'Fill remaining areas with flat primaries. No gradients.' },
      { title: 'Ink lines', text: 'Paint the outlines in black with varied thickness: thick outside, thin inside.' },
      { title: 'Lettering', text: 'Hand-letter the speech bubble in capitals. Pencil guidelines first.' },
    ],
    tips: ['Line quality is the whole painting: practise brush lines on paper first.'],
  },

  // ---------- Minimalism ----------
  {
    id: 'minimalism-beginner-moon',
    title: 'Moon over calm water',
    style: 'minimalism', level: 'beginner', medium: 'watercolor',
    durationMinutes: 45,
    canvas: 'A5 cold-press watercolour paper (300 g/m²)',
    summary: 'One wash, one circle, one reflection. Learn watercolour control.',
    materials: [...WATERCOLOR_BASICS, 'A5 cold-press watercolour paper 300 g/m²', 'A coin or bottle cap to trace the moon'],
    steps: [
      { title: 'Tape and trace', text: 'Tape the paper to a board. Trace a small circle in the upper third for the moon.' },
      { title: 'Wet the sky', text: 'Brush clean water over the sky, avoiding the moon circle.' },
      { title: 'Sky wash', text: 'Drop in dark blue at the top, fading to lighter blue toward the horizon. Tilt the board to let it flow.' },
      { title: 'Water', text: 'Once dry, paint the water a slightly darker blue. Leave a thin, broken vertical strip of white paper under the moon for its reflection.' },
      { title: 'Remove tape', text: 'Wait until completely dry, then peel the tape for a clean border.' },
    ],
    tips: ['White in watercolour is the paper: plan it and protect it.'],
  },
  {
    id: 'minimalism-intermediate-lines',
    title: 'Single continuous line botanical',
    style: 'minimalism', level: 'intermediate', medium: 'acrylic',
    durationMinutes: 90,
    canvas: '30 × 40 cm canvas',
    summary: 'A leaf painted with one unbroken line over a soft two-tone background.',
    materials: [...ACRYLIC_BASICS, 'Long thin liner brush', 'Canvas 30 × 40 cm'],
    steps: [
      { title: 'Two-tone background', text: 'Paint the canvas in a soft neutral (beige or sage). Paint a large organic shape in a second, close tone.' },
      { title: 'Practise the line', text: 'On paper, draw a leaf with one continuous line without lifting the pencil, 5–10 times.' },
      { title: 'Load the liner', text: 'Thin black or dark green paint to an ink-like flow. Load the liner fully.' },
      { title: 'Paint the line', text: 'Paint in one confident motion, standing and moving from the shoulder.' },
      { title: 'Accent', text: 'Optional: add one small circle of terracotta as a counterweight.' },
    ],
    tips: ['Speed gives a smoother line than slowness.'],
  },
  {
    id: 'minimalism-advanced-color-field',
    title: 'Colour-field meditation',
    style: 'minimalism', level: 'advanced', medium: 'oil',
    durationMinutes: 360,
    canvas: '60 × 80 cm canvas',
    summary: 'Rothko-inspired soft-edged rectangles built from many thin glazes.',
    materials: [...OIL_BASICS, 'Alkyd or linseed glazing medium', 'Large soft blending brush', 'Canvas 60 × 80 cm'],
    steps: [
      { title: 'Choose a colour relationship', text: 'Pick 2 colours that vibrate against each other (e.g. deep red and orange, or blue and violet).' },
      { title: 'Ground', text: 'Stain the canvas with a thin wash of the darker colour.' },
      { title: 'First rectangles', text: 'Scrub in 2 rectangles with soft, feathered edges, leaving a margin of ground around them.' },
      { title: 'Glaze layers', text: 'Over several sessions, apply thin glazes. Let each layer dry to the touch between sessions.' },
      { title: 'Edge work', text: 'Soften the rectangle edges so they seem to float and glow.' },
      { title: 'Final review', text: 'View in different lights (morning, evening). Adjust until the painting holds your attention for a full minute.' },
    ],
    tips: ['Most of the work is waiting between glazes: plan for it over a week or two.'],
  },
];
