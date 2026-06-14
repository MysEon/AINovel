import { api } from './core/apiClient.js';

const buildWorldbuildingCrud = (plural) => ({
  list: (projectId) => api.get(`/projects/${projectId}/${plural}`),
  create: (projectId, data) => api.post(`/projects/${projectId}/${plural}`, data),
  update: (itemId, data) => api.put(`/${plural}/${itemId}`, data),
  remove: (itemId) => api.delete(`/${plural}/${itemId}`),
});

export const worldviewService = buildWorldbuildingCrud('worldviews');
export const locationService = buildWorldbuildingCrud('locations');
export const organizationService = buildWorldbuildingCrud('organizations');

export const worldbuildingServices = {
  worldviews: worldviewService,
  locations: locationService,
  organizations: organizationService,
};
