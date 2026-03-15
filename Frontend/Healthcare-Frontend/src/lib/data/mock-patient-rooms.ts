import type { LiveRoomPayload } from '@/types/live-data';

/**
 * Three hardcoded mock patient profiles in the LiveRoomPayload format.
 * These simulate what Gemini would produce from real MongoDB call-session data.
 * IDs use the resident_id UUID convention: full UUID stored, PT-XXXX displayed.
 */
export const mockPatientRooms: LiveRoomPayload[] = [
  {
    roomNumber: 101,
    roomType: 'care',
    priority: 'high',
    occupancyStatus: 'occupied',
    confidence: 1,
    displayColor: '#e79653',
    patient: {
      id: 'cc000000-0000-4000-a000-000000000001',
      displayId: 'PT-cc00',
      age: 78,
      summary:
        'Patient reports severe right knee pain rated 10/10 during phone assessment. Known penicillin allergy on record. Mobility is significantly limited and pain management is the immediate priority.',
      conditions: [
        {
          id: 'PT-cc00-rightLeg-1',
          label: 'Acute knee pain',
          bodyArea: 'rightLeg',
          severity: 'high',
          color: '#e79653',
          shortDescription: 'Potential acute joint discomfort in right knee, rated 10/10 by patient.',
          detailedNotes:
            'Patient described sharp pain localized to the right knee. Severity warrants close monitoring and comfort-focused care. Avoid weight-bearing activities until further evaluation.',
          monitoring: 'Pain scale assessment every 2 hours. Monitor for swelling or heat at the joint.',
          recommendedSupport: 'Assisted transfers only, ice application, elevated rest positioning.',
        },
      ],
    },
  },
  {
    roomNumber: 102,
    roomType: 'care',
    priority: 'critical',
    occupancyStatus: 'occupied',
    confidence: 1,
    displayColor: '#df6e62',
    patient: {
      id: 'dd000000-0000-4000-b000-000000000002',
      displayId: 'PT-dd00',
      age: 85,
      summary:
        'Patient reports persistent chest tightness and shortness of breath that worsens when lying flat. Also mentions occasional dizziness when standing. Currently on blood-pressure medication. Requires close cardiac and respiratory monitoring.',
      conditions: [
        {
          id: 'PT-dd00-heart-1',
          label: 'Chest tightness review',
          bodyArea: 'heart',
          severity: 'critical',
          color: '#df6e62',
          shortDescription: 'Potential cardiac-related chest tightness, worsens in supine position.',
          detailedNotes:
            'Patient described a squeezing sensation in the chest that intensifies when lying down. Episodes last several minutes. Document timing, triggers, and any accompanying symptoms.',
          monitoring: 'Continuous telemetry. Vitals every 30 minutes. Immediate escalation if pain increases.',
          recommendedSupport: 'Head-of-bed elevation at 30 degrees minimum. Oxygen support on standby.',
        },
        {
          id: 'PT-dd00-lungs-1',
          label: 'Respiratory distress watch',
          bodyArea: 'lungs',
          severity: 'high',
          color: '#e79653',
          shortDescription: 'Potential breathing difficulty, worsening with exertion and flat positioning.',
          detailedNotes:
            'Shortness of breath is present at rest and escalates with minimal activity. Encourage slow, paced breathing. Avoid clustering care tasks.',
          monitoring: 'Oxygen saturation checks every hour. Respiratory rate with each vitals round.',
          recommendedSupport: 'Seated or semi-reclined positioning. Breathing exercises between care tasks.',
        },
        {
          id: 'PT-dd00-head-1',
          label: 'Orthostatic dizziness',
          bodyArea: 'head',
          severity: 'medium',
          color: '#e8ca57',
          shortDescription: 'Potential orthostatic lightheadedness when transitioning to standing.',
          detailedNotes:
            'Dizziness reported primarily during sit-to-stand transitions. May be medication-related. Ensure slow position changes and supervised ambulation.',
          monitoring: 'Orthostatic blood pressure checks. Fall-risk reassessment each shift.',
          recommendedSupport: 'Assisted standing with pause-and-check protocol. Non-slip footwear.',
        },
      ],
    },
  },
  {
    roomNumber: 103,
    roomType: 'care',
    priority: 'medium',
    occupancyStatus: 'occupied',
    confidence: 1,
    displayColor: '#e8ca57',
    patient: {
      id: 'ee000000-0000-4000-c000-000000000003',
      displayId: 'PT-ee00',
      age: 71,
      summary:
        'Patient reports dull lower back pain rated 5/10 and intermittent stomach discomfort after meals. Mentions feeling more tired than usual. Takes daily aspirin and statin. No known allergies.',
      conditions: [
        {
          id: 'PT-ee00-abdomen-1',
          label: 'Persistent back and torso ache',
          bodyArea: 'abdomen',
          severity: 'medium',
          color: '#e8ca57',
          shortDescription: 'Potential musculoskeletal discomfort in the lower torso region, rated 5/10.',
          detailedNotes:
            'Patient describes a steady ache in the lower torso area that worsens after sitting for extended periods. Encourage gentle repositioning and supported seating.',
          monitoring: 'Pain assessment each shift. Track whether positioning changes help.',
          recommendedSupport: 'Lumbar support cushion, gentle stretching prompts, heat therapy if tolerated.',
        },
        {
          id: 'PT-ee00-abdomen-2',
          label: 'Post-meal GI discomfort',
          bodyArea: 'abdomen',
          severity: 'low',
          color: '#79c68e',
          shortDescription: 'Potential mild gastrointestinal discomfort following meals.',
          detailedNotes:
            'Intermittent stomach upset reported after larger meals. Smaller, more frequent meals may reduce symptoms. Monitor for any worsening patterns.',
          monitoring: 'Meal intake logging. Note any nausea or bloating after eating.',
          recommendedSupport: 'Smaller portion sizes, upright positioning during and after meals.',
        },
      ],
    },
  },
];

export const mockPatientAvailableRooms = [104, 105, 106];
