export const myOwnConferenceConfig = {
  apiKey: process.env.MY_OWN_CONF_API_KEY,
  baseUrl: 'https://api.mywebinar.com',
  defaultSettings: {
    recording: true,
    maxParticipants: 100,
    duration: 120,
  },
};
