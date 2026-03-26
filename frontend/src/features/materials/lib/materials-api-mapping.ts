import type { BackendMaterialResponse } from "@shared/api/backend-contracts";
import type {
  CreateLibraryMaterialInput,
  LibraryMaterial,
  MaterialType
} from "../types";

export interface BackendCreateMaterialPayload {
  topic_id: string;
  title: string;
  description: string;
  type: MaterialType;
  total_amount: number;
  completed_amount: number;
  position: number;
}

export interface BackendUpdateMaterialPayload {
  title: string;
  description: string;
  type: MaterialType;
  total_amount: number;
  completed_amount: number;
  position: number;
}

export function mapBackendMaterialToLibraryMaterial(
  material: BackendMaterialResponse,
  topicTitle: string
): LibraryMaterial {
  return {
    id: material.id,
    title: material.title,
    description: material.description,
    topicId: material.topic_id,
    topicTitle,
    type: material.type,
    unit: material.unit,
    totalAmount: material.total_amount,
    completedAmount: material.completed_amount,
    position: material.position,
    progressPercent: material.progress
  };
}

export function toBackendCreateMaterialPayload(
  input: CreateLibraryMaterialInput
): BackendCreateMaterialPayload {
  return {
    topic_id: input.topicId,
    title: input.title,
    description: input.description,
    type: input.type,
    total_amount: input.totalAmount,
    completed_amount: input.completedAmount,
    position: input.position
  };
}

export function toBackendUpdateMaterialPayload(input: {
  title: string;
  description: string;
  type: MaterialType;
  totalAmount: number;
  completedAmount: number;
  position: number;
}): BackendUpdateMaterialPayload {
  return {
    title: input.title,
    description: input.description,
    type: input.type,
    total_amount: input.totalAmount,
    completed_amount: input.completedAmount,
    position: input.position
  };
}
