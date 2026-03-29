"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@features/auth/lib/auth-fetch";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import type { TopicNote } from "@features/topics/types";

async function fetchNotes(topicId: string): Promise<TopicNote[]> {
  const res = await authFetch(`/api/topics/${encodeURIComponent(topicId)}/notes`, { method: "GET" });
  if (!res.ok) throw new Error("Failed to load notes");
  return (await res.json()) as TopicNote[];
}

async function createNote(topicId: string): Promise<TopicNote> {
  const res = await authFetch(`/api/topics/${encodeURIComponent(topicId)}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "", content: "" })
  });
  if (!res.ok) throw new Error("Failed to create note");
  return (await res.json()) as TopicNote;
}

async function updateNote(noteId: string, title: string, content: string): Promise<TopicNote> {
  const res = await authFetch(`/api/notes/${encodeURIComponent(noteId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content })
  });
  if (!res.ok) throw new Error("Failed to update note");
  return (await res.json()) as TopicNote;
}

async function deleteNote(noteId: string): Promise<void> {
  const res = await authFetch(`/api/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete note");
}

interface NotesCopy {
  title: string;
  subtitle: string;
  empty: string;
  addNote: string;
  deleteConfirm: string;
  untitled: string;
  titlePlaceholder: string;
  contentPlaceholder: string;
}

const RU_NOTES: NotesCopy = {
  title: "Заметки",
  subtitle: "Ваши записи по теме.",
  empty: "Пока нет заметок. Создайте первую.",
  addNote: "Добавить заметку",
  deleteConfirm: "Удалить заметку?",
  untitled: "Без названия",
  titlePlaceholder: "Название заметки",
  contentPlaceholder: "Текст заметки..."
};

const EN_NOTES: NotesCopy = {
  title: "Notes",
  subtitle: "Your notes for this topic.",
  empty: "No notes yet. Create your first one.",
  addNote: "Add note",
  deleteConfirm: "Delete this note?",
  untitled: "Untitled",
  titlePlaceholder: "Note title",
  contentPlaceholder: "Write your note..."
};

function NoteEditor({
  note,
  copy,
  onSave,
  onDelete
}: {
  note: TopicNote;
  copy: NotesCopy;
  onSave: (noteId: string, title: string, content: string) => void;
  onDelete: (noteId: string) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (newTitle: string, newContent: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onSave(note.id, newTitle, newContent);
      }, 1500);
    },
    [note.id, onSave]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave(value, content);
  }

  function handleContentChange(value: string) {
    setContent(value);
    scheduleSave(title, value);
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (title !== note.title || content !== note.content) {
      onSave(note.id, title, content);
    }
  }

  return (
    <div className="topic-note-editor">
      <div className="topic-note-editor-header">
        <input
          type="text"
          className="topic-note-title-input"
          placeholder={copy.titlePlaceholder}
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={handleBlur}
        />
        <button
          type="button"
          className="topic-note-delete-btn"
          onClick={() => {
            if (confirm(copy.deleteConfirm)) {
              onDelete(note.id);
            }
          }}
          aria-label="Delete note"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <textarea
        className="topic-note-content-textarea"
        placeholder={copy.contentPlaceholder}
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        onBlur={handleBlur}
        rows={4}
      />
    </div>
  );
}

export function TopicNotes({ topicId }: { topicId: string }) {
  const { language } = useUserPreferences();
  const copy = language === "ru" ? RU_NOTES : EN_NOTES;
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const notesQueryKey = ["topic-notes", topicId];

  const { data: notes, isLoading } = useQuery({
    queryKey: notesQueryKey,
    queryFn: () => fetchNotes(topicId),
    staleTime: 30 * 1000
  });

  const createMutation = useMutation({
    mutationFn: () => createNote(topicId),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
      setActiveNoteId(created.id);
      setCollapsed(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ noteId, title, content }: { noteId: string; title: string; content: string }) =>
      updateNote(noteId, title, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: (_, deletedId) => {
      if (activeNoteId === deletedId) setActiveNoteId(null);
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
    }
  });

  const handleSave = useCallback(
    (noteId: string, title: string, content: string) => {
      updateMutation.mutate({ noteId, title, content });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    (noteId: string) => {
      deleteMutation.mutate(noteId);
    },
    [deleteMutation]
  );

  const noteList = notes ?? [];

  return (
    <section className="topic-notes panel">
      <header>
        <div className="topic-panel-header-row">
          <button
            type="button"
            className="topic-notes-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            <div>
              <h3>{copy.title}</h3>
              <p>{copy.subtitle}</p>
            </div>
          </button>
          <button
            type="button"
            className="button button-primary topic-panel-add-button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            {copy.addNote}
          </button>
        </div>
      </header>

      {!collapsed && (
        <>
          {isLoading ? (
            <div className="dashboard-loading" aria-hidden="true">
              <span />
              <span />
            </div>
          ) : noteList.length === 0 ? (
            <p className="dashboard-empty">{copy.empty}</p>
          ) : (
            <div className="topic-notes-list">
              {noteList.map((note) => (
                <div key={note.id} className="topic-note-item">
                  {activeNoteId === note.id ? (
                    <NoteEditor
                      note={note}
                      copy={copy}
                      onSave={handleSave}
                      onDelete={handleDelete}
                    />
                  ) : (
                    <button
                      type="button"
                      className="topic-note-preview"
                      onClick={() => setActiveNoteId(note.id)}
                    >
                      <span className="topic-note-preview-title">
                        {note.title || copy.untitled}
                      </span>
                      {note.content && (
                        <span className="topic-note-preview-snippet">
                          {note.content.slice(0, 100)}
                          {note.content.length > 100 ? "..." : ""}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
