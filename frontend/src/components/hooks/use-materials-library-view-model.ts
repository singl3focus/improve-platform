"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import type {
  LibraryMaterial,
  MaterialsLibraryPayload,
  UpdateLibraryMaterialInput
} from "@/lib/materials-library-types";

const MATERIALS_QUERY_KEY = "materials-library";

export interface MaterialsFilters {
  query: string;
  topicId: string;
}

export interface MaterialDraft {
  title: string;
  description: string;
  topicId: string;
  position: string;
  progressPercent: string;
}

interface CreateMaterialPayload {
  title: string;
  description: string;
  topicId: string;
  position: number;
  progressPercent: number;
}

interface PatchMaterialPayload {
  materialId: string;
  payload: UpdateLibraryMaterialInput;
}

interface MaterialsCopyForViewModel {
  topicRequired: string;
  titleDescriptionRequired: string;
  createFailed: string;
  updateFailed: string;
  deleteFailed: string;
  progressFailed: string;
}

function initialMaterialDraft(): MaterialDraft {
  return {
    title: "",
    description: "",
    topicId: "",
    position: "1",
    progressPercent: "0"
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

  const response = await fetch(`/api/materials?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Materials library request failed."));
  }

  return (await response.json()) as MaterialsLibraryPayload;
}

async function createMaterial(payload: CreateMaterialPayload): Promise<LibraryMaterial> {
  const response = await fetch("/api/materials", {
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
  const response = await fetch(`/api/materials/${encodeURIComponent(materialId)}`, {
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
  const response = await fetch(`/api/materials/${encodeURIComponent(materialId)}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Material removal failed."));
  }
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseProgressPercent(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    return fallback;
  }
  return parsed;
}

function createDraftFromMaterial(material: LibraryMaterial): MaterialDraft {
  return {
    title: material.title,
    description: material.description,
    topicId: material.topicId,
    position: String(material.position),
    progressPercent: String(material.progressPercent)
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!materialsQuery.data) {
      return;
    }

    const topicId = createDraft.topicId || materialsQuery.data.topics[0]?.id || "";
    if (!topicId) {
      setMutationError(copy.topicRequired);
      return;
    }

    const title = createDraft.title.trim();
    const description = createDraft.description.trim();
    if (!title || !description) {
      setMutationError(copy.titleDescriptionRequired);
      return;
    }

    setMutationError(null);
    setIsCreating(true);
    try {
      await createMaterialMutation.mutateAsync({
        title,
        description,
        topicId,
        position: parsePositiveInteger(createDraft.position, 1),
        progressPercent: parseProgressPercent(createDraft.progressPercent, 0)
      });

      setCreateDraft({
        ...initialMaterialDraft(),
        topicId
      });
      await invalidateMaterialsQuery();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : copy.createFailed);
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
    if (!title || !description || !editDraft.topicId) {
      setMutationError(copy.titleDescriptionRequired);
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
          topicId: editDraft.topicId,
          position: parsePositiveInteger(editDraft.position, 1),
          progressPercent: parseProgressPercent(editDraft.progressPercent, 0)
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

  async function handleProgressUpdate(materialId: string, progressPercent: number) {
    const queryKey = [MATERIALS_QUERY_KEY, filters] as const;
    const previousData = queryClient.getQueryData<MaterialsLibraryPayload>(queryKey);

    setMutationError(null);
    setUpdatingMaterialId(materialId);
    if (previousData) {
      queryClient.setQueryData<MaterialsLibraryPayload>(queryKey, {
        ...previousData,
        materials: previousData.materials.map((material) =>
          material.id === materialId
            ? {
                ...material,
                progressPercent
              }
            : material
        )
      });
    }

    try {
      await patchMaterialMutation.mutateAsync({
        materialId,
        payload: { progressPercent }
      });
      await invalidateMaterialsQuery();
    } catch (error) {
      if (previousData) {
        queryClient.setQueryData<MaterialsLibraryPayload>(queryKey, previousData);
      }
      setMutationError(error instanceof Error ? error.message : copy.progressFailed);
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
    materialsQuery,
    availableTopics,
    handleCreate,
    startEditing,
    cancelEditing,
    handleEditSubmit,
    handleDelete,
    handleProgressUpdate
  };
}
