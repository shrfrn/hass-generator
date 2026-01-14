// Sample generator configuration for testing
// Tests various config options from CONFIG_OPTIONS.md

export default {
  schemaVersion: 1,
  default_vacancy_duration: '00:10:00',
  excluded_labels: ['outdoor'],

  areas: {
    living_room: {
      include_in_group: ['switch.lr_soc_e'],
      exclude_from_group: ['light.lr_accent'],
    },

    bedroom: {
      vacancy_timer_duration: '00:05:00',
      dimmable_companions: {
        'switch.mb_soc': 'light.mb_soc_bulb',
      },
    },

    front_yard: {
      // Override global exclusion - include outdoor lights for this area
      included_labels: ['outdoor'],
    },
  },
}
