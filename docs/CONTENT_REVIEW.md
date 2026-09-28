# Guide review checklist (for a painter or art teacher)

The 15 curated guides in `server/content/guides.js` were written without review by a practising painter.
Before launch, someone with teaching experience should check each one. You can do this in the app
(Discover → pick style and level → open the guide) or directly in the file.

## What to check in every guide

**Level fit**
- [ ] A person at this level can realistically finish it in the stated time.
- [ ] The subject and number of colours suit the level (beginners: few colours, forgiving technique).

**Materials**
- [ ] The list is complete — nothing is needed in the steps that is missing from the list.
- [ ] Colours, brush types and sizes, and canvas size are correct for the medium.
- [ ] Nothing is unnecessarily expensive; student-grade alternatives are fine.

**Steps**
- [ ] Steps are in the right order and each has a clear, visible result.
- [ ] Drying times are mentioned where the painter must wait.
- [ ] Terms a beginner may not know (e.g. "glaze", "scumble", "fat over lean") are explained or avoided.

**Safety**
- [ ] Oil guides mention ventilation and safe disposal of solvent-soaked rags (they can self-ignite).
- [ ] No step suggests toxic pigments or solvents without a warning.

**Accuracy**
- [ ] Art-history references (e.g. Monet, Caillebotte, Rothko) are correct and used only as inspiration.

## Guides

Tick a column when checked; write required changes in *Notes*.

| ID | Title | Style | Level | Medium | Time | Level fit | Materials | Steps & safety | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `realism-beginner-apple` | A single apple on a table | realism | beginner | acrylic | 90 min | ☐ | ☐ | ☐ | |
| `realism-intermediate-cup` | Coffee cup still life | realism | intermediate | acrylic | 180 min | ☐ | ☐ | ☐ | |
| `realism-advanced-portrait` | Portrait study from a photo | realism | advanced | oil | 480 min | ☐ | ☐ | ☐ | |
| `impressionism-beginner-sunset` | Sunset over a field | impressionism | beginner | acrylic | 75 min | ☐ | ☐ | ☐ | |
| `impressionism-intermediate-garden` | Garden path with flowers | impressionism | intermediate | oil | 240 min | ☐ | ☐ | ☐ | |
| `impressionism-advanced-rainy-street` | Rainy city street at dusk | impressionism | advanced | oil | 420 min | ☐ | ☐ | ☐ | |
| `abstract-beginner-color-blocks` | Colour blocks with tape | abstract | beginner | acrylic | 60 min | ☐ | ☐ | ☐ | |
| `abstract-intermediate-knife` | Textured palette-knife landscape | abstract | intermediate | acrylic | 150 min | ☐ | ☐ | ☐ | |
| `abstract-advanced-emotion` | Expressive abstract from a feeling | abstract | advanced | acrylic | 300 min | ☐ | ☐ | ☐ | |
| `pop-art-beginner-fruit` | Pop-art banana | pop-art | beginner | gouache | 60 min | ☐ | ☐ | ☐ | |
| `pop-art-intermediate-portrait` | Four-colour pop portrait | pop-art | intermediate | acrylic | 180 min | ☐ | ☐ | ☐ | |
| `pop-art-advanced-comic` | Comic-panel narrative painting | pop-art | advanced | acrylic | 360 min | ☐ | ☐ | ☐ | |
| `minimalism-beginner-moon` | Moon over calm water | minimalism | beginner | watercolor | 45 min | ☐ | ☐ | ☐ | |
| `minimalism-intermediate-lines` | Single continuous line botanical | minimalism | intermediate | acrylic | 90 min | ☐ | ☐ | ☐ | |
| `minimalism-advanced-color-field` | Colour-field meditation | minimalism | advanced | oil | 360 min | ☐ | ☐ | ☐ | |

## AI-generated guides

AI guides (enabled with `ANTHROPIC_API_KEY`) appear in the admin **Review queue** (My page → Admin).
Use the same checklist before pressing **Publish**. Until published, an AI guide is only visible to the
person who created it, with a clear "not reviewed" notice.
