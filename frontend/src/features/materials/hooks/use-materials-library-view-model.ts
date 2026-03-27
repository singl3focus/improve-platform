"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type {
  LibraryMaterial,
  MaterialsLibraryPayload,
  MaterialType,
  UpdateLibraryMaterialInput
} from "@features/materials/types";
import {
  computeProgressPercent,
  parsePositiveInteger,
  parseNonNegativeInteger,
  resolveUnitByType
} from "@features/materials/lib/materials-form";

const MATERIALS_QUERY_KEY = "materials-library";

export interface MaterialsFilters {
  query: string;
  topicId: string;
}

export interface MaterialDraft {
  title: string;
  description: string;
  url: string;
  topicId: string;
  type: MaterialType;
  unit: string;
  totalAmount: string;
  completedAmount: string;
  position: string;
}

interface CreateMaterialPayload {
  title: string;
  description: string;
  url: string;
  topicId: string;
  type: MaterialType;
  totalAmount: number;
  completedAmount: number;
  position: number;
}

interface PatchMaterialPayload {
  materialId: string;
  payload: UpdateLibraryMaterialInput;
}

interface MaterialsCopyForViewModel {
  topicRequired: string;
  titleDescriptionRequired: string;
  amountInvalid: string;
  createFailed: string;
  updateFailed: string;
  deleteFailed: string;
}

function initialMaterialDraft(): MaterialDraft {
  const type: MaterialType = "book";
  return {
    title: "",
    description: "",
    url: "",
    topicId: "",
    type,
    unit: resolveUnitByType(type),
    totalAmount: "0",
    completedAmount: "0",
    position: "1",
  };
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (typeof payload?.message === "string") {
      return payload.message;
    }
  } catch {
    // Ignore non-JSON errors.
  }
  return fallback;
}

async function fetchMaterialsLibrary(
  filters: MaterialsFilters,
  signal?: AbortSignal
): Promise<MaterialsLibraryPayload> {
  const params = new URLSearchParams();
  if (filters.query) {
    params.set("q", filters.query);
  }
  if (filters.topicId) {
    params.set("topicId", filters.topicId);
  }

  const response = await authFetch(`/api/materials?${params.toString()}`, {
    method: "GET",
    signal
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Materials library request failed."));
  }

  return (await response.json()) as MaterialsLibraryPayload;
}

async function createMaterial(payload: CreateMaterialPayload): Promise<LibraryMaterial> {
  const response = await authFetch("/api/materials", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Material creation failed."));
  }

  return (await response.json()) as LibraryMaterial;
}

async function patchMaterial(
  materialId: string,
  payload: UpdateLibraryMaterialInput
): Promise<LibraryMaterial> {
  const response = await authFetch(`/api/materials/${encodeURIComponent(materialId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Material update failed."));
  }

  return (await response.json()) as LibraryMaterial;
}

async function removeMaterial(materialId: string): Promise<void> {
  const response = await authFetch(`/api/materials/${encodeURIComponent(materialId)}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Material removal failed."));
  }
}

function createDraftFromMaterial(material: LibraryMaterial): MaterialDraft {
  return {
    title: material.title,
    description: material.description,
    url: material.url,
    topicId: material.topicId,
    type: material.type,
    unit: material.unit,
    totalAmount: String(material.totalAmount),
    completedAmount: String(material.completedAmount),
    position: String(material.position),
  };
}

export function useMaterialsLibraryViewModel(copy: MaterialsCopyForViewModel) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<MaterialsFilters>({
    query: "",
    topicId: ""
  });
  const [createDraft, setCreateDraft] = useState<MaterialDraft>(initialMaterialDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<MaterialDraft | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingMaterialId, setUpdatingMaterialId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  function clearMutationError() {
    setMutationError(null);
  }

  const materialsQuery = useQuery<MaterialsLibraryPayload>({
    queryKey: [MATERIALS_QUERY_KEY, filters] as const,
    queryFn: ({ signal }) => fetchMaterialsLibrary(filters, signal),
    retry: false
  });
  const createMaterialMutation = useMutation<LibraryMaterial, Error, CreateMaterialPayload>({
    mutationFn: createMaterial
  });
  const patchMaterialMutation = useMutation<LibraryMaterial, Error, PatchMaterialPayload>({
    mutationFn: ({ materialId, payload }) => patchMaterial(materialId, payload)
  });
  const deleteMaterialMutation = useMutation<void, Error, string>({
    mutationFn: removeMaterial
  });

  const availableTopics = materialsQuery.data?.topics ?? [];

  useEffect(() => {
    if (materialsQuery.status !== "success" || createDraft.topicId) {
      return;
    }

    const fallbackTopic = materialsQuery.data?.topics[0];
    if (!fallbackTopic) {
      return;
    }

    setCreateDraft((current) => ({
      ...current,
      topicId: fallbackTopic.id
    }));
  }, [createDraft.topicId, materialsQuery.data, materialsQuery.status]);

  async function invalidateMaterialsQuery(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: [MATERIALS_QUERY_KEY]
    });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault();
    if (!materialsQuery.data) {
      return false;
    }

    const topicId = createDraft.topicId || materialsQuery.data.topics[0]?.id || "";
    if (!topicId) {
      setMutationError(copy.topicRequired);
      return false;
    }

    const title = createDraft.title.trim();
    const description = createDraft.description.trim();
    if (!title) {
      setMutationError(copy.titleDescriptionRequired);
      return false;
    }

    const totalAmount = parseNonNegativeInteger(createDraft.totalAmount, 0);
    const completedAmount = parseNonNegativeInteger(createDraft.completedAmount, 0);
    if (completedAmount > totalAmount) {
      setMutationError(copy.amountInvalid);
      return false;
    }

    setMutationError(null);
    setIsCreating(true);
    try {
      await createMaterialMutation.mutateAsync({
        title,
        description,
        url: createDraft.url.trim(),
        topicId,
        type: createDraft.type,
        totalAmount,
        completedAmount,
        position: parsePositiveInteger(createDraft.position, 1),
      });

      setCreateDraft({
        ...initialMaterialDraft(),
        topicId
      });
      await invalidateMaterialsQuery();
      return true;
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : copy.createFailed);
      return false;
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(material: LibraryMaterial) {
    setEditingId(material.id);
    setEditDraft(createDraftFromMaterial(material));
    setMutationError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !editDraft) {
      return;
    }

    const title = editDraft.title.trim();
    const description = editDraft.description.trim();
    if (!title || !editDraft.topicId) {
      setMutationError(copy.titleDescriptionRequired);
      return;
    }

    const totalAmount = parseNonNegativeInteger(editDraft.totalAmount, 0);
    const completedAmount = parseNonNegativeInteger(editDraft.completedAmount, 0);
    if (completedAmount > totalAmount) {
      setMutationError(copy.amountInvalid);
      return;
    }

    setMutationError(null);
    setUpdatingMaterialId(editingId);
    try {
      await patchMaterialMutation.mutateAsync({
        materialId: editingId,
        payload: {
          title,
          description,
          url: editDraft.url.trim(),
          topicId: editDraft.topicId,
          type: editDraft.type,
          totalAmount,
          completedAmount,
          position: parsePositiveInteger(editDraft.position, 1),
        }
      });
      cancelEditing();
      await invalidateMaterialsQuery();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : copy.updateFailed);
    } finally {
      setUpdatingMaterialId(null);
    }
  }

  async function handleDelete(materialId: string) {
    setMutationError(null);
    setUpdatingMaterialId(materialId);
    try {
      await deleteMaterialMutation.mutateAsync(materialId);
      if (editingId === materialId) {
        cancelEditing();
      }
      await invalidateMaterialsQuery();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : copy.deleteFailed);
    } finally {
      setUpdatingMaterialId(null);
    }
  }

  return {
    filters,
    setFilters,
    createDraft,
    setCreateDraft,
    editingId,
    editDraft,
    setEditDraft,
    isCreating,
    updatingMaterialId,
    mutationError,
    clearMutationError,
    materialsQuery,
    availableTopics,
    handleCreate,
    startEditing,
    cancelEditing,
    handleEditSubmit,
    handleDelete,
    computeProgressPercent
  };
}
