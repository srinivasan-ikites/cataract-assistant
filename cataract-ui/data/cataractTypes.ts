// Static data for all cataract types used in the My Diagnosis modal

export interface CataractType {
    id: string;
    name: string;
    shortName: string;
    tagline: string;              // One-line summary for cards

    // Structured content sections for patient education
    whatItIs: string;             // 1-2 sentence simple explanation
    whereItForms: string;         // Location in eye (simple)
    whyItHappens: string[];       // Causes as bullet points
    howItAffectsVision: string[]; // Vision effects as bullets
    riskFactors?: string[];       // Who is at risk (optional)
    goodToKnow: string;           // Reassuring note about treatment

    // Legacy field - kept for backward compatibility
    detailedDescription: string;
    description: string;

    symptoms: string[];
    eyeImage: string;
    healthyEyeImage: string;         // Which healthy eye image to compare against
    imageScale?: number;             // Zoom level for cataract image in slider (default 1)
    color: string;
    bgColor: string;
}

// CSS filter effects to simulate each cataract type's vision impact
export const CATARACT_VISION_EFFECTS: Record<string, string> = {
    'nuclear_sclerosis': 'blur(3px) sepia(40%) brightness(0.85) contrast(0.9)',
    'cortical': 'blur(2px) brightness(0.9) contrast(0.85)',
    'posterior_subcapsular': 'blur(4px) brightness(0.8)',
    'congenital': 'blur(2px) sepia(20%) brightness(0.9)',
    'combined': 'blur(3px) sepia(30%) brightness(0.85) contrast(0.85)',
    'default': 'blur(3px) brightness(0.85)',
};

// All known cataract types (5 primary types)
export const ALL_CATARACT_TYPES: CataractType[] = [
    {
        id: 'nuclear_sclerosis',
        name: 'Nuclear Sclerosis',
        shortName: 'Nuclear',
        tagline: 'Yellowing and hardening in the center of the lens',

        whatItIs: 'A clouding in the CENTER of your eye\'s lens that causes it to harden and turn yellow or brown over time. This is the most common type of age-related cataract.',

        whereItForms: 'In the nucleus — the very center of your natural lens, like the core of a fruit.',

        whyItHappens: [
            'Natural part of aging — happens to most people eventually',
            'Proteins in the lens gradually break down over time',
            'Usually begins developing in your 40s or 50s',
            'Progresses slowly over many years',
        ],

        howItAffectsVision: [
            'Colors appear more yellow or faded',
            'Difficulty seeing clearly in dim lighting',
            'Reduced contrast — edges and details look blurry',
            'May temporarily improve your reading vision (called "second sight")',
            'Gradual dimming of overall vision',
        ],

        goodToKnow: 'This type develops slowly, often over many years, giving your eyes time to adapt. Many people don\'t notice changes at first. Surgery is recommended when it starts affecting daily activities like driving, reading, or recognizing faces. The good news: cataract surgery is highly effective for this type.',

        // Legacy fields
        description: 'Hardening and yellowing of the central lens nucleus. Most common age-related cataract causing gradual vision dimming.',
        detailedDescription: 'Nuclear Sclerosis is the most common type of age-related cataract. It occurs when the central part of the lens (the nucleus) gradually hardens and turns yellow or brown over time. This process is a natural part of aging, typically beginning in middle age and progressing slowly.',

        symptoms: ['Yellowed vision', 'Difficulty with contrast', 'Gradual vision dimming', 'Changes in nearsightedness'],
        eyeImage: '/assets/diagnosis/eye_nuclear_sclerosis1.png',
        healthyEyeImage: '/assets/diagnosis/eye_healthy2.png',
        imageScale: 1.05,
        color: '#F59E0B',
        bgColor: '#FEF3C7',
    },
    {
        id: 'cortical',
        name: 'Cortical Cataract',
        shortName: 'Cortical',
        tagline: 'Spoke-like streaks that start at the edges of the lens',

        whatItIs: 'White, spoke-like streaks that form around the EDGES of your lens and gradually extend toward the center — similar to spokes on a bicycle wheel.',

        whereItForms: 'In the cortex — the outer layer that surrounds the center of your lens, like the flesh of a fruit around its core.',

        whyItHappens: [
            'Age-related changes in the lens proteins',
            'Diabetes can increase the risk',
            'Long-term UV light exposure from sunlight',
            'May run in families',
        ],

        howItAffectsVision: [
            'Glare and "starbursts" around lights, especially at night',
            'Difficulty driving at night due to headlight glare',
            'Bright lights feel uncomfortable or blinding',
            'Vision becomes hazy or foggy',
            'Problems with depth perception',
        ],

        riskFactors: [
            'Diabetes',
            'Prolonged sun exposure without protection',
            'Family history of cortical cataracts',
        ],

        goodToKnow: 'Glare is the main concern with this type — many people first notice problems when driving at night. Surgery is especially helpful if night driving has become difficult or feels unsafe. Wearing sunglasses with UV protection may help slow progression.',

        // Legacy fields
        description: 'Spoke-like opacities that start at the lens edge and grow toward the center. Often causes glare sensitivity.',
        detailedDescription: 'Cortical Cataracts develop in the lens cortex, the outer edge of the lens. They appear as white, wedge-shaped opacities or spokes that start at the periphery and gradually extend toward the center of the lens, much like the spokes of a bicycle wheel.',

        symptoms: ['Glare from lights', 'Hazy vision', 'Difficulty with bright light', 'Night driving problems'],
        eyeImage: '/assets/diagnosis/eye_cortical1.png',
        healthyEyeImage: '/assets/diagnosis/eye_healthy1.png',
        color: '#8B5CF6',
        bgColor: '#EDE9FE',
    },
    {
        id: 'posterior_subcapsular',
        name: 'Posterior Subcapsular',
        shortName: 'PSC',
        tagline: 'Forms at the back of the lens, directly in your line of sight',

        whatItIs: 'A cloudy area that forms at the BACK of your lens, directly in the path of light entering your eye. Even small PSC cataracts can significantly affect your vision because of their central location.',

        whereItForms: 'At the back surface of the lens, right in your central line of sight — like a smudge in the middle of a camera lens.',

        whyItHappens: [
            'Diabetes is a common cause',
            'Long-term steroid use (pills, inhalers, or eye drops)',
            'Previous eye injury or surgery',
            'High nearsightedness (myopia)',
            'Radiation exposure',
        ],

        howItAffectsVision: [
            'Reading and close-up work become difficult',
            'Glare and halos around lights',
            'Vision is often worse in bright light',
            'May actually see better in dim lighting',
            'Rapid changes in vision quality',
        ],

        riskFactors: [
            'Diabetes',
            'Steroid medications (even inhalers)',
            'Previous eye trauma',
            'High myopia (severe nearsightedness)',
            'Younger age compared to other cataract types',
        ],

        goodToKnow: 'This type can develop faster than others and often affects people at a younger age. Because it sits directly in your line of sight, even a small cataract can cause noticeable symptoms. Surgery is often recommended earlier than with other types. The good news: surgery provides excellent results.',

        // Legacy fields
        description: 'Forms at the back of the lens. Often interferes with reading and glare. Common in younger patients and diabetics.',
        detailedDescription: 'Posterior Subcapsular Cataracts (PSC) develop at the back of the lens, directly in the path of light entering the eye. This location makes them particularly disruptive to vision, even when they are relatively small.',

        symptoms: ['Reading difficulty', 'Glare and halos', 'Worse vision in bright light', 'Rapid vision changes'],
        eyeImage: '/assets/diagnosis/eye_posterior_subcapsular1.png',
        healthyEyeImage: '/assets/diagnosis/eye_healthy2.png',
        color: '#3B82F6',
        bgColor: '#DBEAFE',
    },
    {
        id: 'combined',
        name: 'Combined Cataract',
        shortName: 'Combined',
        tagline: 'Multiple cataract types present in the same eye',

        whatItIs: 'When you have MORE THAN ONE type of cataract in the same eye. Most commonly, this means nuclear sclerosis (in the center) combined with cortical changes (at the edges).',

        whereItForms: 'Multiple areas of the lens are affected at the same time — both the center and outer regions.',

        whyItHappens: [
            'Same factors that cause individual cataract types',
            'Very common as cataracts progress over time',
            'Natural progression of age-related lens changes',
            'One type may develop first, then another joins',
        ],

        howItAffectsVision: [
            'Blurred vision in all lighting conditions',
            'Both glare problems AND dimming/yellowing',
            'Difficulty with both reading AND distance vision',
            'Colors appear faded or washed out',
            'Challenges with driving day and night',
        ],

        goodToKnow: 'Having multiple types of cataract does NOT make surgery more complicated or risky. Modern cataract surgery removes your entire natural lens, so all types are treated at the same time. You\'ll receive a single new artificial lens that replaces everything.',

        // Legacy fields
        description: 'Combination of Nuclear Sclerosis and Cortical cataracts affecting multiple layers of the lens simultaneously.',
        detailedDescription: 'Combined Cataracts occur when multiple types of cataracts develop in the same eye simultaneously. The most common combination involves both Nuclear Sclerosis (central lens hardening) and Cortical Cataracts (spoke-like opacities from the edges).',

        symptoms: ['Blurred vision', 'Glare from headlights', 'Difficulty reading', 'Night driving problems', 'Faded colors'],
        eyeImage: '/assets/diagnosis/eye_combined1.png',
        healthyEyeImage: '/assets/diagnosis/eye_healthy2.png',
        color: '#EC4899',
        bgColor: '#FCE7F3',
    },
    {
        id: 'congenital',
        name: 'Congenital Cataract',
        shortName: 'Congenital',
        tagline: 'Present at birth or developed during childhood',

        whatItIs: 'A cataract that was present at BIRTH or developed during early childhood. This is different from age-related cataracts in both cause and timing.',

        whereItForms: 'Can occur anywhere in the lens — the location and size vary widely between individuals.',

        whyItHappens: [
            'Genetic or inherited factors (runs in families)',
            'Infections during pregnancy (such as rubella or herpes)',
            'Metabolic disorders',
            'Trauma during birth or early childhood',
            'Sometimes no specific cause is found',
        ],

        howItAffectsVision: [
            'Effects vary widely based on size and location',
            'May have been managed since childhood',
            'Can affect one eye or both eyes',
            'Some are small and don\'t affect vision much',
            'Others may have required early treatment',
        ],

        riskFactors: [
            'Family history of congenital cataracts',
            'Maternal infections during pregnancy',
            'Certain genetic syndromes',
            'Premature birth',
        ],

        goodToKnow: 'If you\'ve had cataracts since birth, you may have already received treatment in childhood. Your current care plan depends on your specific situation — the size and location of the cataract, any previous treatments, and your current visual needs. Your doctor will create a personalized approach for you.',

        // Legacy fields
        description: 'Present at birth or formed during childhood due to genetics or infection. May affect one or both eyes.',
        detailedDescription: 'Congenital Cataracts are lens opacities that are present at birth or develop during early childhood. Unlike age-related cataracts, these form during the critical period of visual development.',

        symptoms: ['Present from birth', 'Variable severity', 'May affect one or both eyes', 'Previous childhood treatment possible'],
        eyeImage: '/assets/diagnosis/eye_congenital1.png',
        healthyEyeImage: '/assets/diagnosis/eye_healthy1.png',
        color: '#10B981',
        bgColor: '#D1FAE5',
    },
];

/**
 * Get cataract type object from the structured primary_cataract_type field.
 * This is the NEW preferred method - uses structured data instead of text parsing.
 */
export function getCataractTypeFromId(primaryCataractType: string | undefined): CataractType | null {
    if (!primaryCataractType) return null;
    return ALL_CATARACT_TYPES.find(c => c.id === primaryCataractType) || null;
}

/**
 * Get list of cataract types the patient does NOT have (for the "Other Types" section).
 * Uses the structured field instead of parsing pathology text.
 */
export function getOtherCataractTypes(primaryCataractType: string | undefined): CataractType[] {
    if (!primaryCataractType) return ALL_CATARACT_TYPES;
    return ALL_CATARACT_TYPES.filter(c => c.id !== primaryCataractType);
}

/**
 * Get the CSS filter effect for simulating cataract vision.
 * Uses the structured field for direct lookup.
 */
export function getCataractVisionEffect(primaryCataractType: string | undefined): string {
    if (!primaryCataractType) return CATARACT_VISION_EFFECTS['default'];
    return CATARACT_VISION_EFFECTS[primaryCataractType] || CATARACT_VISION_EFFECTS['default'];
}

// ===== LEGACY FUNCTIONS (DEPRECATED - for backward compatibility) =====
// These functions parse the pathology text field. They are kept for now
// but should be removed once all data uses the structured field.

/**
 * @deprecated Use getCataractTypeFromId() with primary_cataract_type field instead
 */
export function parsePatientCataractTypes(pathology: string): CataractType[] {
    const lower = pathology.toLowerCase();
    const matched: CataractType[] = [];

    if (lower.includes('combined') || (lower.includes('nuclear') && lower.includes('cortical'))) {
        const combined = ALL_CATARACT_TYPES.find(c => c.id === 'combined');
        if (combined) matched.push(combined);
        return matched; // If combined, don't add individual types
    }

    if (lower.includes('nuclear') || lower.includes('sclerosis')) {
        const nuclear = ALL_CATARACT_TYPES.find(c => c.id === 'nuclear_sclerosis');
        if (nuclear) matched.push(nuclear);
    }
    if (lower.includes('cortical')) {
        const cortical = ALL_CATARACT_TYPES.find(c => c.id === 'cortical');
        if (cortical) matched.push(cortical);
    }
    if (lower.includes('posterior') || lower.includes('subcapsular') || lower.includes('psc')) {
        const psc = ALL_CATARACT_TYPES.find(c => c.id === 'posterior_subcapsular');
        if (psc) matched.push(psc);
    }
    if (lower.includes('congenital')) {
        const cong = ALL_CATARACT_TYPES.find(c => c.id === 'congenital');
        if (cong) matched.push(cong);
    }

    return matched;
}
