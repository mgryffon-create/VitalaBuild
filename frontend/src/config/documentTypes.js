/**
 * Structured Document Type Configuration
 * Single source of truth for categories, groups, and document types.
 */

export const DOCUMENT_CATEGORIES = {
  medical: {
    label: "Medical Documents",
    icon: "Heart",
    color: "text-red-600 bg-red-100 dark:bg-red-900/30",
    groups: {
      vaccinations: {
        label: "Vaccinations",
        types: [
          "COVID-19 Vaccine",
          "Influenza (Flu)",
          "Hepatitis B",
          "MMR",
          "Varicella",
          "Tdap",
          "Other Vaccination",
        ],
      },
      tb_clearance: {
        label: "TB / Medical Clearance",
        types: [
          "TB Skin Test (PPD)",
          "TB Blood Test (Quantiferon)",
          "Chest X-Ray (TB Clearance)",
          "Physical Exam",
        ],
      },
    },
  },
  certification: {
    label: "Certifications",
    icon: "Shield",
    color: "text-green-600 bg-green-100 dark:bg-green-900/30",
    types: ["BLS", "ACLS", "PALS", "CPR", "CNA Certificate"],
  },
  identification: {
    label: "Identification",
    icon: "CreditCard",
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    types: ["Driver's License", "Passport", "State ID"],
  },
  license: {
    label: "Licenses",
    icon: "FileText",
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
    types: ["RN License", "CNA License", "LPN License", "LVN License"],
  },
  compliance: {
    label: "Compliance Documents",
    icon: "ClipboardCheck",
    color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
    types: [
      "Background Check",
      "Drug Screen",
      "Professional Liability Insurance",
      "NPI Certificate",
      "DEA License",
    ],
  },
};

/**
 * Returns a flat array of all types within a category.
 * For "medical", this merges all group types.
 */
export function getTypesForCategory(categoryKey) {
  const cat = DOCUMENT_CATEGORIES[categoryKey];
  if (!cat) return [];
  if (cat.types) return cat.types;
  if (cat.groups) {
    return Object.values(cat.groups).flatMap((g) => g.types);
  }
  return [];
}

/**
 * Returns grouped structure for a category (only medical has groups).
 * For non-grouped categories, returns null.
 */
export function getGroupsForCategory(categoryKey) {
  const cat = DOCUMENT_CATEGORIES[categoryKey];
  if (!cat?.groups) return null;
  return cat.groups;
}
