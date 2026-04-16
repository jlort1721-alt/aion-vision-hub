import { memo, useState, useCallback } from "react";
import {
  useUserScenes,
  useCreateScene,
  useUpdateScene,
  useDeleteScene,
} from "@/services/user-scenes-api";
import type { UserScene } from "@/services/user-scenes-api";
import {
  Plus,
  Save,
  Trash2,
  Share2,
  Layout,
  Camera,
  DoorOpen,
  Phone,
  Lightbulb,
  Bell,
} from "lucide-react";

interface SceneComposerProps {
  onSceneLoad: (layout: UserScene["layout"]) => void;
}

const WIDGET_TYPES = [
  { type: "camera" as const, icon: Camera, label: "Cámara" },
  { type: "door" as const, icon: DoorOpen, label: "Puerta" },
  { type: "intercom" as const, icon: Phone, label: "Citófono" },
  { type: "iot" as const, icon: Lightbulb, label: "IoT" },
  { type: "events" as const, icon: Bell, label: "Eventos" },
];

function SceneComposerInner({ onSceneLoad }: SceneComposerProps) {
  const { data: scenes, isLoading } = useUserScenes();
  const createScene = useCreateScene();
  const updateScene = useUpdateScene();
  const deleteScene = useDeleteScene();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    await createScene.mutateAsync({
      name: newName.trim(),
      layout: [],
      isShared: false,
    });
    setNewName("");
    setShowCreateForm(false);
  }, [newName, createScene]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteScene.mutateAsync(id);
    },
    [deleteScene],
  );

  const handleToggleShare = useCallback(
    async (scene: UserScene) => {
      await updateScene.mutateAsync({
        id: scene.id,
        isShared: !scene.isShared,
      });
    },
    [updateScene],
  );

  const handleRename = useCallback(
    async (id: string) => {
      if (!editName.trim()) return;
      await updateScene.mutateAsync({ id, name: editName.trim() });
      setEditingId(null);
    },
    [editName, updateScene],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-navy-900/40">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-brand-red-600" />
          <h3 className="text-sm font-semibold text-white">Escenas</h3>
        </div>
        <button
          className="p-1 rounded hover:bg-navy-700 text-muted-foreground hover:text-white"
          onClick={() => setShowCreateForm(!showCreateForm)}
          title="Nueva escena"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showCreateForm && (
        <div className="flex gap-1 px-2 py-2 border-b">
          <input
            className="flex-1 px-2 py-1 text-xs rounded bg-navy-800 border border-navy-600 text-white placeholder:text-muted-foreground"
            placeholder="Nombre de la escena"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <button
            className="px-2 py-1 text-xs rounded bg-brand-red-600 hover:bg-brand-red-700 text-white disabled:opacity-40"
            onClick={handleCreate}
            disabled={!newName.trim() || createScene.isPending}
          >
            <Save className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {isLoading && (
          <p className="text-xs text-muted-foreground px-1">Cargando...</p>
        )}
        {scenes?.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground px-1">
            Sin escenas guardadas
          </p>
        )}
        {scenes?.map((scene) => (
          <div
            key={scene.id}
            className="flex items-center gap-1 p-2 rounded bg-navy-800/60 hover:bg-navy-800 group"
          >
            {editingId === scene.id ? (
              <input
                className="flex-1 px-1 py-0.5 text-xs rounded bg-navy-700 border border-navy-500 text-white"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename(scene.id)}
                onBlur={() => setEditingId(null)}
                autoFocus
              />
            ) : (
              <button
                className="flex-1 text-left text-xs font-medium truncate text-white hover:text-brand-red-400"
                onClick={() => onSceneLoad(scene.layout)}
                onDoubleClick={() => {
                  setEditingId(scene.id);
                  setEditName(scene.name);
                }}
                title="Click para cargar, doble-click para renombrar"
              >
                {scene.name}
              </button>
            )}

            <span className="text-[10px] text-muted-foreground">
              {scene.layout.length}w
            </span>

            <button
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-navy-600"
              onClick={() => handleToggleShare(scene)}
              title={scene.isShared ? "Dejar de compartir" : "Compartir"}
            >
              <Share2
                className={`w-3 h-3 ${scene.isShared ? "text-green-400" : "text-muted-foreground"}`}
              />
            </button>

            <button
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-navy-600"
              onClick={() => handleDelete(scene.id)}
              title="Eliminar"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          </div>
        ))}
      </div>

      <div className="px-2 py-2 border-t">
        <p className="text-[10px] text-muted-foreground mb-1">
          Widgets disponibles
        </p>
        <div className="flex gap-1 flex-wrap">
          {WIDGET_TYPES.map((wt) => {
            const Icon = wt.icon;
            return (
              <div
                key={wt.type}
                className="flex items-center gap-1 px-2 py-1 rounded bg-navy-800/60 text-[10px] text-muted-foreground cursor-grab"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({
                      type: wt.type,
                      col: 0,
                      row: 0,
                      colSpan: 3,
                      rowSpan: 3,
                    }),
                  );
                }}
              >
                <Icon className="w-3 h-3" />
                {wt.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const SceneComposer = memo(SceneComposerInner);
