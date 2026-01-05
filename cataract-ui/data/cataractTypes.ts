// Static data for all cataract types used in the My Diagnosis modal

export interface CataractType {
    id: string;
    name: string;
    shortName: string;
    description: string;
    detailedDescription: string;
    symptoms: string[];
    eyeImage: string;
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
        description: 'Hardening and yellowing of the central lens nucleus. Most common age-related cataract causing gradual vision dimming.',
        detailedDescription: 'Nuclear Sclerosis is the most common type of age-related cataract. It occurs when the central part of the lens (the nucleus) gradually hardens and turns yellow or brown over time. This process is a natural part of aging, typically beginning in middle age and progressing slowly.\n\nAs the nucleus becomes more opaque, you may notice your vision gradually dimming, especially in low-light conditions. Many people with nuclear sclerosis also experience a shift toward nearsightedness, which can paradoxically improve their reading vision temporarily before the cataract worsens. Colors may appear more yellowed or less vibrant, and contrast sensitivity decreases, making it harder to distinguish objects from their backgrounds.\n\nNuclear sclerosis develops slowly, often over many years. The visual changes are usually gradual, allowing the eye to adapt to some extent. Surgical treatment becomes necessary when the cataract significantly impacts daily activities like driving, reading, or recognizing faces.',
        symptoms: ['Yellowed vision', 'Difficulty with contrast', 'Nearsightedness changes'],
        eyeImage: '/assets/diagnosis/eye_nuclear_sclerosis.png',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
    },
    {
        id: 'cortical',
        name: 'Cortical Cataract',
        shortName: 'Cortical',
        description: 'Spoke-like opacities that start at the lens edge and grow toward the center. Often causes glare sensitivity.',
        detailedDescription: 'Cortical Cataracts develop in the lens cortex, the outer edge of the lens. They appear as white, wedge-shaped opacities or spokes that start at the periphery and gradually extend toward the center of the lens, much like the spokes of a bicycle wheel.\n\nThese cataracts are particularly problematic because they scatter light as it enters the eye, leading to significant glare sensitivity. People with cortical cataracts often experience difficulty driving at night due to the "starburst" effect around headlights. Bright sunlight and indoor lighting can also cause discomfort and visual disturbances.\n\nThe progression of cortical cataracts can vary—some grow slowly while others develop more rapidly. As the opacities extend toward the center of the lens, vision becomes increasingly hazy and blurred. Cortical cataracts can occur alone or in combination with other cataract types, and they may affect one or both eyes.\n\nTreatment is recommended when the cataract interferes with normal activities, especially if glare becomes a safety concern, such as when driving at night becomes difficult or dangerous.',
        symptoms: ['Glare from lights', 'Hazy vision', 'Difficulty with bright light'],
        eyeImage: '/assets/diagnosis/eye_cortical.png',
        color: '#8B5CF6',
        bgColor: '#EDE9FE',
    },
    {
        id: 'posterior_subcapsular',
        name: 'Posterior Subcapsular',
        shortName: 'PSC',
        description: 'Forms at the back of the lens. Often interferes with reading and glare. Common in younger patients and diabetics.',
        detailedDescription: 'Posterior Subcapsular Cataracts (PSC) develop at the back of the lens, directly in the path of light entering the eye. This location makes them particularly disruptive to vision, even when they are relatively small.\n\nPSC cataracts often develop more rapidly than other types and can significantly impact reading and near vision. Because they form in the central visual axis, they create glare and halos around lights, especially in bright conditions. Many people with PSC cataracts report that their vision is worse in bright sunlight and improves slightly in dimmer lighting.\n\nThis type of cataract is more common in younger patients compared to other age-related cataracts. People with diabetes, those taking long-term steroid medications, or individuals with high myopia (nearsightedness) are at increased risk. PSC cataracts can also develop after eye trauma or inflammation.\n\nDue to their central location and rapid progression, PSC cataracts often require treatment earlier than other cataract types. Surgery is typically recommended when the cataract begins to significantly interfere with daily activities, especially reading and driving.',
        symptoms: ['Reading difficulty', 'Glare and halos', 'Reduced vision in bright light'],
        eyeImage: '/assets/diagnosis/eye_posterior_subcapsular.png',
        color: '#3B82F6',
        bgColor: '#DBEAFE',
    },
    {
        id: 'combined',
        name: 'Combined Cataract',
        shortName: 'Combined',
        description: 'Combination of Nuclear Sclerosis and Cortical cataracts affecting multiple layers of the lens simultaneously.',
        detailedDescription: 'Combined Cataracts occur when multiple types of cataracts develop in the same eye simultaneously. The most common combination involves both Nuclear Sclerosis (central lens hardening) and Cortical Cataracts (spoke-like opacities from the edges).\n\nWhen both types are present, they can create compounded visual effects. You may experience the yellowing and dimming associated with nuclear sclerosis along with the glare sensitivity and light scattering characteristic of cortical cataracts. This combination often results in more significant vision impairment than either type alone.\n\nSymptoms can include blurred vision in all lighting conditions, significant glare from headlights and bright lights, difficulty reading due to both reduced clarity and glare, and challenges with driving, especially at night. Colors may appear less vibrant, and contrast sensitivity is typically reduced.\n\nCombined cataracts can progress at varying rates depending on which component is more advanced. Treatment is recommended when the combined effects significantly impact daily activities and quality of life. Modern cataract surgery can effectively treat both types simultaneously, restoring clear vision.',
        symptoms: ['Blurred vision', 'Glare from headlights', 'Difficulty reading and driving'],
        eyeImage: '/assets/diagnosis/eye_combined.png',
        color: '#EC4899',
        bgColor: '#FCE7F3',
    },
    {
        id: 'congenital',
        name: 'Congenital Cataract',
        shortName: 'Congenital',
        description: 'Present at birth or formed during childhood due to genetics or infection. May affect one or both eyes.',
        detailedDescription: 'Congenital Cataracts are lens opacities that are present at birth or develop during early childhood. Unlike age-related cataracts, these form during the critical period of visual development, which can have significant implications for vision and eye development.\n\nCongenital cataracts can be caused by genetic factors, intrauterine infections (such as rubella), metabolic disorders, trauma, or may occur without a known cause. They can affect one eye (unilateral) or both eyes (bilateral), and the severity can vary widely from small, non-progressive opacities to complete lens opacification.\n\nIf a congenital cataract is significant enough to block vision in an infant or young child, it can lead to amblyopia (lazy eye) and permanent vision loss if not treated promptly. The brain requires clear visual input during early childhood to develop normal vision pathways. For this reason, significant congenital cataracts often require surgical removal during infancy or early childhood.\n\nAdults who have had congenital cataracts since birth may have managed the condition throughout their lives, sometimes with surgery in childhood. The treatment approach depends on the cataract\'s size, location, and impact on vision, as well as the patient\'s age and visual needs.',
        symptoms: ['Present from birth', 'May affect development', 'Varies in severity'],
        eyeImage: '/assets/diagnosis/eye_congenital.png',
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
