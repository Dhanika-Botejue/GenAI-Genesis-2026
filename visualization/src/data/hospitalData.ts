export type RoomPriority = 'red' | 'yellow' | 'green' | 'blue';
export type BodyArea = 'heart' | 'lungs' | 'liver' | 'legs' | 'kidney' | 'abdomen' | 'head';
export type Severity = 'Critical' | 'High' | 'Moderate' | 'Stable';
export type Vector3Tuple = [number, number, number];

export interface Condition {
  id: string;
  organ: string;
  bodyArea: BodyArea;
  label: string;
  severity: Severity;
  color: string;
  description: string;
  carePlan: string;
  support: string;
  monitoring: string;
  pulseOffset?: Vector3Tuple;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  room: string;
  summary: string;
  conditions: Condition[];
}

export interface RoomSceneConfig {
  position: [number, number];
  size: [number, number];
  focusTarget: Vector3Tuple;
  cameraOffset: Vector3Tuple;
  patientOffset: Vector3Tuple;
}

export interface RoomRecord {
  id: string;
  name: string;
  priorityColor: RoomPriority;
  occupancyStatus: 'Occupied' | 'Monitoring' | 'Observation';
  patient: Patient;
  scene: RoomSceneConfig;
}

export const priorityMeta: Record<
  RoomPriority,
  {
    label: string;
    fill: string;
    line: string;
    soft: string;
  }
> = {
  red: {
    label: 'Urgent',
    fill: '#f87171',
    line: '#ef4444',
    soft: '#fee2e2',
  },
  yellow: {
    label: 'Moderate',
    fill: '#facc15',
    line: '#ca8a04',
    soft: '#fef3c7',
  },
  green: {
    label: 'Stable',
    fill: '#34d399',
    line: '#10b981',
    soft: '#dcfce7',
  },
  blue: {
    label: 'General',
    fill: '#60a5fa',
    line: '#3b82f6',
    soft: '#dbeafe',
  },
};

export const signalLegend = [
  {
    label: 'Cardiac / urgent',
    color: '#ff6b6b',
  },
  {
    label: 'Organ / acute review',
    color: '#ff8f5a',
  },
  {
    label: 'Mobility / fall risk',
    color: '#f7c948',
  },
  {
    label: 'Respiratory / airway',
    color: '#5ea4ff',
  },
  {
    label: 'Routine stability',
    color: '#45c08a',
  },
] as const;

export const nurseStation = {
  name: 'Nurse Station',
  position: [-5.35, 3.65] as [number, number],
  size: [6.3, 6.9] as [number, number],
  tint: '#7ab2ff',
};

export const hospitalRooms: RoomRecord[] = [
  {
    id: 'room-1',
    name: 'Room 1',
    priorityColor: 'blue',
    occupancyStatus: 'Monitoring',
    patient: {
      id: 'patient-1',
      name: 'Eleanor Price',
      age: 82,
      room: 'Room 1',
      summary: 'Respiratory rehab patient with intermittent dizziness and monitored mobility support.',
      conditions: [
        {
          id: 'condition-1',
          organ: 'Lungs',
          bodyArea: 'lungs',
          label: 'Respiratory watch',
          severity: 'Moderate',
          color: '#5ea4ff',
          description: 'Mild exertional desaturation after assisted walking rounds.',
          carePlan: 'Nebulizer support, paced breathing cues, and seated recovery after transfers.',
          support: 'Portable oxygen, elevated headrest, incentive spirometer.',
          monitoring: 'SpO2 every 2 hours with rehab tolerance notes.',
          pulseOffset: [-0.16, 0.05, 0],
        },
        {
          id: 'condition-2',
          organ: 'Lower Extremities',
          bodyArea: 'legs',
          label: 'Fall-risk mobility alert',
          severity: 'Moderate',
          color: '#f7c948',
          description: 'Unsteady gait when turning from bed to chair without support.',
          carePlan: 'Two-point walker at bedside and coached transfers with staff assistance.',
          support: 'Low bed, pressure mat, walker, non-slip socks.',
          monitoring: 'Mobility score logged each shift and after rehabilitation sessions.',
          pulseOffset: [0.08, 0, 0],
        },
      ],
    },
    scene: {
      position: [0.65, -3.25],
      size: [3.9, 3.1],
      focusTarget: [1.15, 1.05, -2.9],
      cameraOffset: [-2.1, 2.45, 3.35],
      patientOffset: [0.45, 0, 0.35],
    },
  },
  {
    id: 'room-2',
    name: 'Room 2',
    priorityColor: 'red',
    occupancyStatus: 'Occupied',
    patient: {
      id: 'patient-2',
      name: 'Samuel Reed',
      age: 77,
      room: 'Room 2',
      summary: 'High-acuity cardiac observation with fluid balance management and telemetry review.',
      conditions: [
        {
          id: 'condition-3',
          organ: 'Heart',
          bodyArea: 'heart',
          label: 'Cardiac rhythm instability',
          severity: 'Critical',
          color: '#ff6b6b',
          description: 'Episodes of rapid atrial response requiring close telemetry checks.',
          carePlan: 'Limit exertion, maintain continuous rhythm observation, and escalate with symptom change.',
          support: 'Telemetry patch, recliner positioning, rapid access crash cart routing.',
          monitoring: 'Live rhythm trend review with nurse sign-off every 30 minutes.',
          pulseOffset: [0.05, 0.04, 0.02],
        },
        {
          id: 'condition-4',
          organ: 'Kidneys',
          bodyArea: 'kidney',
          label: 'Fluid balance concern',
          severity: 'High',
          color: '#ff8f5a',
          description: 'Reduced urine output overnight with elevated dehydration risk.',
          carePlan: 'Strict intake/output tracking and staged fluid support per care team.',
          support: 'Intake charting station, assisted hydration schedule, pressure-relief recliner.',
          monitoring: 'Fluid chart updates every shift with morning lab correlation.',
          pulseOffset: [0.18, -0.02, 0.02],
        },
      ],
    },
    scene: {
      position: [4.55, -3.25],
      size: [3.15, 3.1],
      focusTarget: [4.95, 1.05, -2.9],
      cameraOffset: [-0.4, 2.35, 3.85],
      patientOffset: [0.25, 0, 0.35],
    },
  },
  {
    id: 'room-3',
    name: 'Room 3',
    priorityColor: 'green',
    occupancyStatus: 'Observation',
    patient: {
      id: 'patient-3',
      name: 'Lina Chen',
      age: 85,
      room: 'Room 3',
      summary: 'Recovery phase patient with stable vitals and ongoing nutrition and comfort monitoring.',
      conditions: [
        {
          id: 'condition-5',
          organ: 'Abdomen',
          bodyArea: 'abdomen',
          label: 'Nutrition support tracking',
          severity: 'Stable',
          color: '#45c08a',
          description: 'Gradual appetite return after reduced oral intake earlier this week.',
          carePlan: 'Small frequent meals, hydration prompts, and seated posture during meals.',
          support: 'Meal support tray, hydration station, upright chair positioning.',
          monitoring: 'Meal completion and hydration prompts logged at each check-in.',
          pulseOffset: [0, 0, 0],
        },
        {
          id: 'condition-6',
          organ: 'Head',
          bodyArea: 'head',
          label: 'Delirium prevention watch',
          severity: 'Moderate',
          color: '#5ea4ff',
          description: 'Sundowning risk managed with orientation cues and quieter evening routine.',
          carePlan: 'Low-noise environment, visual clock cues, and family-call schedule.',
          support: 'Orientation board, warm lighting, hearing-aid support.',
          monitoring: 'Orientation status reviewed on each evening round.',
          pulseOffset: [0, 0.03, 0],
        },
      ],
    },
    scene: {
      position: [8.15, -3.25],
      size: [3.15, 3.1],
      focusTarget: [8.45, 1.05, -2.95],
      cameraOffset: [1.35, 2.35, 3.95],
      patientOffset: [0.15, 0, 0.32],
    },
  },
  {
    id: 'room-4',
    name: 'Room 4',
    priorityColor: 'yellow',
    occupancyStatus: 'Monitoring',
    patient: {
      id: 'patient-4',
      name: 'Gloria Martinez',
      age: 80,
      room: 'Room 4',
      summary: 'Moderate-priority hepatic monitoring with fatigue management and assisted ambulation.',
      conditions: [
        {
          id: 'condition-7',
          organ: 'Liver',
          bodyArea: 'liver',
          label: 'Liver function review',
          severity: 'High',
          color: '#ff8f5a',
          description: 'Tenderness and lab variance prompting closer hepatic symptom checks.',
          carePlan: 'Energy conservation, medication adherence, and comfort-led activity pacing.',
          support: 'Medication organizer, reclining support, warm blanket therapy.',
          monitoring: 'Daily symptom note with lab trend comparison.',
          pulseOffset: [0.18, 0.02, 0.02],
        },
        {
          id: 'condition-8',
          organ: 'Lower Extremities',
          bodyArea: 'legs',
          label: 'Fatigue-linked fall risk',
          severity: 'Moderate',
          color: '#f7c948',
          description: 'Slower transfer response in the evening with increased stand-by needs.',
          carePlan: 'Scheduled assisted walks and seated rest between care tasks.',
          support: 'Rollator, transfer belt, bedside nightlight.',
          monitoring: 'Fatigue and gait status reassessed during evening rounds.',
          pulseOffset: [-0.05, 0, 0.01],
        },
      ],
    },
    scene: {
      position: [10.9, 3.25],
      size: [5.2, 5.2],
      focusTarget: [10.65, 1.05, 3.45],
      cameraOffset: [3.25, 2.7, 2.65],
      patientOffset: [0.9, 0, 0.65],
    },
  },
  {
    id: 'room-5',
    name: 'Room 5',
    priorityColor: 'red',
    occupancyStatus: 'Occupied',
    patient: {
      id: 'patient-5',
      name: 'Harold Bennett',
      age: 88,
      room: 'Room 5',
      summary: 'Escalated respiratory and cardiac co-monitoring with nighttime assistance needs.',
      conditions: [
        {
          id: 'condition-9',
          organ: 'Heart',
          bodyArea: 'heart',
          label: 'Chest pain surveillance',
          severity: 'High',
          color: '#ff6b6b',
          description: 'Intermittent chest discomfort after repositioning requiring symptom correlation.',
          carePlan: 'Frequent comfort checks, paced repositioning, and immediate escalation if pain rises.',
          support: 'Head-elevated bed, bedside call assist, ECG-ready equipment.',
          monitoring: 'Pain scale and cardiac response documented with every episode.',
          pulseOffset: [-0.05, 0.03, 0.01],
        },
        {
          id: 'condition-10',
          organ: 'Lungs',
          bodyArea: 'lungs',
          label: 'Respiratory reserve concern',
          severity: 'High',
          color: '#5ea4ff',
          description: 'Shallow breathing pattern when fatigued overnight.',
          carePlan: 'Breathing exercises, oxygen support during rest, and short activity windows.',
          support: 'Pulse oximeter, oxygen tubing support, respiratory pillow wedge.',
          monitoring: 'Continuous spot checks with escalation for sustained decline.',
          pulseOffset: [0.16, 0.02, 0.02],
        },
      ],
    },
    scene: {
      position: [4.05, 2.75],
      size: [3.7, 3.2],
      focusTarget: [4.35, 1.05, 2.95],
      cameraOffset: [2.55, 2.4, 3.25],
      patientOffset: [0.3, 0, 0.35],
    },
  },
];

export const allConditions = hospitalRooms.flatMap((room) => room.patient.conditions);
