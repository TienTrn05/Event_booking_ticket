export const usersSchemas = {
  UserProfile: {
    type: 'object',
    required: ['id', 'displayName', 'avatarUrl', 'gender', 'dateOfBirth'],
    properties: {
      id: { type: 'string' },
      displayName: { type: 'string' },
      avatarUrl: { type: 'string', format: 'uri', nullable: true },
      gender: {
        type: 'string',
        nullable: true,
        enum: ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED', null],
      },
      dateOfBirth: { type: 'string', format: 'date', nullable: true },
    },
  },
};
