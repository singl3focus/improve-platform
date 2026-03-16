"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type {
  LibraryMaterial,
  MaterialsLibraryPayload,
  UpdateLibraryMaterialInput
} from "@/lib/materials-library-types";

const MATERIALS_QUERY_KEY = "materials-library";
const PROGRESS_COMMIT_DEBOUNCE_MS = 320;

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

function normalizeProgressPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 100) {
    return 100;
  }
  return rounded;
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
  const progressTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const queuedProgressRef = useRef<Map<string, number>>(new Map());
  const inFlightProgressRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    const progressTimers = progressTimersRef.current;
    const queuedProgress = queuedProgressRef.current;
    const inFlightProgress = inFlightProgressRef.current;

    return () => {
      for (const timer of progressTimers.values()) {
        clearTimeout(timer);
      }
      progressTimers.clear();
      queuedProgress.clear();
      inFlightProgress.clear();
    };
  }, []);

  async function invalidateMaterialsQuery(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: [MATERIALS_QUERY_KEY]
    });
  }

  function updateProgressInCache(materialId: string, progressPercent: number) {
    const queryKey = [MATERIALS_QUERY_KEY, filters] as const;
    const cached = queryClient.getQueryData<MaterialsLibraryPayload>(queryKey);
    if (!cached) {
      return;
    }

    queryClient.setQueryData<MaterialsLibraryPayload>(queryKey, {
      ...cached,
      materials: cached.materials.map((material) =>
        material.id === materialId
          ? {
              ...material,
              progressPercent
            }
          : material
      )
    });
  }

  async function flushProgressCommit(materialId: string) {
    const timer = progressTimersRef.current.get(materialId);
    if (timer) {
      clearTimeout(timer);
      progressTimersRef.current.delete(materialId);
    }

    if (inFlightProgressRef.current.has(materialId)) {
      return;
    }

    let shouldInvalidate = false;

    while (queuedProgressRef.current.has(materialId)) {
      const nextProgress = queuedProgressRef.current.get(materialId);
      if (typeof nextProgress !== "number") {
        queuedProgressRef.current.delete(materialId);
        continue;
      }

      queuedProgressRef.current.delete(materialId);
      inFlightProgressRef.current.add(materialId);

      try {
        await patchMaterialMutation.mutateAsync({
          materialId,
          payload: { progressPercent: nextProgress }
        });
        shouldInvalidate = true;
      } catch (error) {
        setMutationError(error instanceof Error ? error.message : copy.progressFailed);
        shouldInvalidate = true;
        break;
      } finally {
        inFlightProgressRef.current.delete(materialId);
      }
    }

    if (shouldInvalidate) {
      await invalidateMaterialsQuery();
    }
  }

  function scheduleProgressCommit(materialId: string) {
    const currentTimer = progressTimersRef.current.get(materialId);
    if (currentTimer) {
      clearTimeout(currentTimer);
    }

    const timer = setTimeout(() => {
      void flushProgressCommit(materialId);
    }, PROGRESS_COMMIT_DEBOUNCE_MS);
    progressTimersRef.current.set(materialId, timer);
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
    if (!title || !description) {
      setMutationError(copy.titleDescriptionRequired);
      return false;
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

  function handleProgressPreview(materialId: string, progressPercent: number) {
    const normalizedProgress = normalizeProgressPercent(progressPercent);
    setMutationError(null);
    queuedProgressRef.current.set(materialId, normalizedProgress);
    updateProgressInCache(materialId, normalizedProgress);
    scheduleProgressCommit(materialId);
  }

  function handleProgressCommit(materialId: string, progressPercent?: number) {
    if (typeof progressPercent === "number") {
      const normalizedProgress = normalizeProgressPercent(progressPercent);
      queuedProgressRef.current.set(materialId, normalizedProgress);
      updateProgressInCache(materialId, normalizedProgress);
    }

    void flushProgressCommit(materialId);
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
    handleProgressPreview,
    handleProgressCommit
  };
}
