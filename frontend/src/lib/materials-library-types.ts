export interface MaterialsTopicOption {
  id: string;
  title: string;
}

export type MaterialType = "book" | "article" | "course" | "video";
export type MaterialUnit = "pages" | "lessons" | "hours";

export const MATERIAL_TYPE_TO_UNIT: Record<MaterialType, MaterialUnit> = {
  book: "pages",
  article: "pages",
  course: "lessons",
  video: "hours"
};

export interface LibraryMaterial {
  id: string;
  title: string;
  description: string;
  topicId: string;
  topicTitle: string;
  type: MaterialType;
  unit: MaterialUnit;
  totalAmount: number;
  completedAmount: number;
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
  type: MaterialType;
  totalAmount: number;
  completedAmount: number;
  position: number;
}

export interface UpdateLibraryMaterialInput {
  title?: string;
  description?: string;
  topicId?: string;
  type?: MaterialType;
  totalAmount?: number;
  completedAmount?: number;
  position?: number;
}
