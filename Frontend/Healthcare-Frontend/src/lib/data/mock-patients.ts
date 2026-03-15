import type { BodyAnchorId, Condition, Patient, Severity } from '@/types/domain';
import { getPatientDisplayId } from '@/lib/data/patient-identity';
import { severityToColor } from '@/lib/scene/priority-colors';

const conditionTemplates: Array<{
  label: string;
  bodyArea: BodyAnchorId;
  severity: Severity;
  shortDescription: string;
  detailedNotes: string;
  monitoring: string;
  recommendedSupport: string;
}> = [
  {
    label: 'Respiratory watch',
    bodyArea: 'lungs',
    severity: 'high',
    shortDescription: 'Breathing becomes shallow after short exertion windows.',
    detailedNotes: 'Staff should encourage paced recovery and limit clustered exertion tasks during the same round.',
    monitoring: 'Spot oxygen checks after mobility and at evening rounds.',
    recommendedSupport: 'Seated recovery, breathing prompts, and oxygen support if prescribed.',
  },
  {
    label: 'Cardiac rhythm review',
    bodyArea: 'heart',
    severity: 'critical',
    shortDescription: 'Irregular pulse episodes require closer escalation awareness.',
    detailedNotes: 'Avoid sudden transfer strain and document symptom timing with any rhythm irregularity reports.',
    monitoring: 'Telemetry review and symptom correlation every 30-60 minutes.',
    recommendedSupport: 'Head-elevated rest and low-exertion transfer assistance.',
  },
  {
    label: 'Delirium prevention watch',
    bodyArea: 'head',
    severity: 'medium',
    shortDescription: 'Evening disorientation risk rises when routines are disrupted.',
    detailedNotes: 'Quiet cues, familiar routines, and clear orientation prompts reduce escalation overnight.',
    monitoring: 'Evening orientation checks and sleep-pattern notes.',
    recommendedSupport: 'Orientation board, hearing support, and warmer bedside lighting.',
  },
  {
    label: 'Nutrition intake support',
    bodyArea: 'abdomen',
    severity: 'low',
    shortDescription: 'Meal completion remains inconsistent across the day.',
    detailedNotes: 'Smaller, more frequent meals and hydration prompts work better than large tray loads.',
    monitoring: 'Meal percentage and hydration reminders each shift.',
    recommendedSupport: 'Hydration schedule and upright meal positioning.',
  },
  {
    label: 'Liver function review',
    bodyArea: 'liver',
    severity: 'high',
    shortDescription: 'Tenderness and fatigue suggest closer hepatic symptom review.',
    detailedNotes: 'Energy conservation and medication adherence should be paired with comfort-led activity pacing.',
    monitoring: 'Daily symptom notes with lab trend comparison.',
    recommendedSupport: 'Medication organizer, recliner support, and shorter assisted walks.',
  },
  {
    label: 'Mobility fall-risk alert',
    bodyArea: 'leftLeg',
    severity: 'medium',
    shortDescription: 'Transfer stability drops after fatigue or rushed repositioning.',
    detailedNotes: 'Transfers should stay coached and paced rather than stacked together during busy rounds.',
    monitoring: 'Mobility score each shift and after rehab sessions.',
    recommendedSupport: 'Walker access, transfer belt, and non-slip footwear.',
  },
  {
    label: 'Arm swelling watch',
    bodyArea: 'rightArm',
    severity: 'low',
    shortDescription: 'Localized swelling requires comfort and circulation checks.',
    detailedNotes: 'Keep the limb supported and avoid pressure-heavy positioning during seated rest.',
    monitoring: 'Site appearance and comfort notes twice daily.',
    recommendedSupport: 'Arm elevation cushion and careful repositioning.',
  },
  {
    label: 'Chest pain surveillance',
    bodyArea: 'chest',
    severity: 'high',
    shortDescription: 'Intermittent chest discomfort needs symptom trend tracking.',
    detailedNotes: 'Episodes are brief but should be documented with context around transfer or exertion triggers.',
    monitoring: 'Pain scale and associated symptoms with each report.',
    recommendedSupport: 'Rest-first response, rapid escalation pathway, and comfort positioning.',
  },
];

function rotate<T>(items: readonly T[], start: number, count: number): T[] {
  return Array.from({ length: count }, (_, index) => items[(start + index) % items.length]);
}

export function buildMockPatientPool(count = 20): Patient[] {
  return Array.from({ length: count }, (_, index) => {
    const severityRotation = rotate(conditionTemplates, index, 2 + (index % 3));
    const conditions: Condition[] = severityRotation.map((template, conditionIndex) => ({
      id: `patient-${index + 1}-condition-${conditionIndex + 1}`,
      label: template.label,
      bodyArea: template.bodyArea,
      severity: template.severity,
      color: severityToColor[template.severity],
      shortDescription: template.shortDescription,
      detailedNotes: template.detailedNotes,
      monitoring: template.monitoring,
      recommendedSupport: template.recommendedSupport,
    }));

    return {
      id: `patient-${index + 1}`,
      name: getPatientDisplayId({ id: `patient-${index + 1}` }),
      age: 76 + (index % 14),
      summary: `Anonymous patient record under active elderly-care monitoring with ${conditions.length} tracked condition${conditions.length > 1 ? 's' : ''}.`,
      conditions,
    };
  });
}
