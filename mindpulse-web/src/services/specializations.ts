export const OTHER_SPECIALIZATION = 'Others';

export interface SpecializationGroup {
  label: string;
  options: string[];
}

export const SPECIALIZATION_GROUPS: SpecializationGroup[] = [
  {
    label: 'Psychology specialties (PAP / PRC)',
    options: [
      'Clinical Psychology',
      'Counseling Psychology',
      'Assessment Psychology',
      'Developmental Psychology',
      'Educational Psychology',
      'Industrial-Organizational Psychology',
      'Social Psychology',
    ],
  },
  {
    label: 'Clinical and counseling areas',
    options: [
      'Neuropsychology',
      'Forensic Psychology',
      'Health Psychology',
      'School Psychology',
      'Rehabilitation Psychology',
      'Child and Adolescent Psychology',
    ],
  },
  {
    label: 'Mental health professions',
    options: [
      'Psychiatrist (MD)',
      'Psychometrician',
      'Guidance Counselor',
      'Licensed Professional Counselor',
      'Marriage and Family Therapist',
      'Clinical Social Worker',
    ],
  },
];

export const isSpecializationOption = (value: string): boolean =>
  SPECIALIZATION_GROUPS.some((group) => group.options.includes(value));
