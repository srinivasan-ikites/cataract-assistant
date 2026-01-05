/**
 * Clinical medication lists for Cataract Surgery (Pre-Op and Post-Op)
 * Based on Doctor's requirements.
 */

export const ANTIBIOTIC_OPTIONS = [
    { id: 1, name: 'Moxifloxacin (Vigamox)' },
    { id: 2, name: 'Besifloxacin (Besivance)' },
    { id: 3, name: 'Gatifloxacin (Zymaxid)' },
    { id: 4, name: 'Ofloxacin (Ocuflox)' },
    { id: 5, name: 'Ciprofloxacin (Ciloxan)' }
];

export const FREQUENCY_OPTIONS = [
    { id: 1, name: '4 times a day' },
    { id: 2, name: '3 times a day' },
    { id: 3, name: '2 times a day' },
    { id: 4, name: 'Once a day' },
];

export const getAntibioticName = (id: number) => ANTIBIOTIC_OPTIONS.find(o => o.id === id)?.name || '';
export const getFrequencyName = (id: number) => FREQUENCY_OPTIONS.find(o => o.id === id)?.name || '';

export const POST_OP_ANTIBIOTICS = [
    "Moxifloxacin",
    "Ciprofloxacin",
    "Gatifloxacin",
    "Tobramycin",
    "Neomycin-Polymyxin" // Note: Check for Sulfa allergy
];

export const POST_OP_NSAIDS = [
    { name: "Ketorolac", defaultFrequency: 4, label: "4x Daily" },
    { name: "Bromfenac (Prolensa, Bromday, Bromsite)", defaultFrequency: 1, label: "1x Daily" },
    { name: "Nepafenac (Nevanac, Ilevro)", defaultFrequency: 1, label: "1x Daily", variableFrequency: true }
];

export const POST_OP_STEROIDS = [
    "Prednisolone Acetate 1% (Pred Forte)",
    "Loteprednol (Lotemax)",
    "Durezol (difluprednate)",
    "Dexamethasone"
];

export const GLAUCOMA_DROPS = [
    "Latanoprost (Xalatan, Xelpros, Iyuzeh)",
    "Bimatoprost (Lumigan)",
    "Travaprost (Travatan)",
    "Tafluprost (Zioptan)",
    "Latanoprostene Bunod (Vyzulta)",
    "Netarsudil/latanoprost (Rocklatan)",
    "Timolol (Timoptic, Istalol, Betimol)",
    "Betaxolol (Betoptic)",
    "Brimonidine (Alphagan)",
    "Dorzolamide (Trusopt)",
    "Brinzolamide (Azopt)",
    "Dorzolamide+Timolol (Cosopt)",
    "Brimonidine+Timolol (Combigan)",
    "Brinzolamide+Brimonidine (Simbrinza)",
    "Latanoprost+Timolol (Xalacom)",
    "Travaprost+Timolol (Duotrav)"
];

export const COMBO_DROP_EXAMPLES = [
    "Pred-Gati-Nep",
    "Pred-Moxi-Brom",
    "Pred-Moxi-Ketor"
];
