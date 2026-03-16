export interface MaterialsTopicOption {
  id: string;
  title: string;
}

export interface LibraryMaterial {
  id: string;
  title: string;
  description: string;
  topicId: string;
  topicTitle: string;
  position: number;
  progressPercent: number;
}

export interface MaterialsLibraryPayload {
  materials: LibraryMaterial[];
  topics: MaterialsTopicOption[];
}

export interface CreateLibraryMaterialInput {
  title: string;
  description: string;
  topicId: string;
  position: number;
  progressPercent: number;
}

export interface UpdateLibraryMaterialInput {
  title?: string;
  description?: string;
  topicId?: string;
  position?: number;
  progressPercent?: number;
}
