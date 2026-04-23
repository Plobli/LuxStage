import { api } from './client'

export const fetchTemplateSections = (name: string): Promise<any> =>
  api.get(`/api/templates/${encodeURIComponent(name)}/sections`)

export const saveTemplateSections = (name: string, sections: any[]): Promise<any> =>
  api.put(`/api/templates/${encodeURIComponent(name)}/sections`, { sections })

export const fetchShowSections = (id: string): Promise<any[]> =>
  api.get(`/api/shows/${id}/sections`)  // returns [{ id, content }]

export const saveShowSections = (id: string, sections: any[]): Promise<any> =>
  api.put(`/api/shows/${id}/sections`, sections)  // sends [{ id, content }]

export const fetchShowSectionDefs = (id: string): Promise<any[]> =>
  api.get(`/api/shows/${id}/section-defs`)

export const saveShowSectionDefs = (id: string, sections: any[]): Promise<any> =>
  api.put(`/api/shows/${id}/section-defs`, { sections })

