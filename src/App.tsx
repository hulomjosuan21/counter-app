import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GripVertical, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";

// -------------------- TYPES -------------------- //
type NodeType = "display" | "increment" | "decrement";

type DisplayNodeData = { count: number };
type IncDecNodeData = { type: "increment" | "decrement" };

type CounterFlowContextType = {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
};

const CounterFlowContext = createContext<CounterFlowContextType | null>(null);

const useCounterFlow = () => {
  const ctx = useContext(CounterFlowContext);
  if (!ctx) throw new Error("useCounterFlow must be inside provider");
  return ctx;
};

// -------------------- NODE COMPONENTS -------------------- //
const DisplayCountNode = ({ data }: { id: string; data: DisplayNodeData }) => {
  return (
    <div className="border rounded-md px-4 py-2 flex flex-col items-center bg-background">
      <span className="text-sm font-semibold">Count: {data.count}</span>
      <Handle
        type="target"
        position={Position.Bottom}
        className="bg-foreground"
      />
    </div>
  );
};

const IncrementDecrementNode = ({
  id,
  data,
}: {
  id: string;
  data: IncDecNodeData;
}) => {
  const { edges, setNodes } = useCounterFlow();

  const connectedDisplays = edges
    .filter((e) => e.source === id || e.target === id)
    .map((e) => (e.source === id ? e.target : e.source))
    .filter((nid) => nid.startsWith("display"));

  const isConnected = connectedDisplays.length > 0;

  const handleClick = () => {
    if (!isConnected) return;

    setNodes((nds) =>
      nds.map((n) =>
        connectedDisplays.includes(n.id)
          ? {
              ...n,
              data: {
                ...n.data,
                count:
                  data.type === "increment"
                    ? (n.data as DisplayNodeData).count + 1
                    : (n.data as DisplayNodeData).count - 1,
              },
            }
          : n
      )
    );
  };

  return (
    <div
      onClick={handleClick}
      className={`border rounded-md p-2 font-semibold cursor-pointer bg-background text-xs transition ${
        isConnected ? "hover:bg-accent" : "opacity-50 cursor-not-allowed"
      }`}
    >
      <Handle type="source" position={Position.Top} className="bg-foreground" />
      {data.type === "increment" ? (
        <Plus className="h-4 w-4" />
      ) : (
        <Minus className="h-4 w-4" />
      )}
    </div>
  );
};

// -------------------- PROVIDER -------------------- //
const CounterFlowProvider = ({ children }: { children: React.ReactNode }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Fake API load on mount
  useEffect(() => {
    const loadData = async () => {
      toast("Loading data...");
      await new Promise((res) => setTimeout(res, 1000));

      setNodes([
        {
          id: "display-1",
          type: "display",
          position: { x: 250, y: 100 },
          data: { count: 0 },
        },
      ]);
      setEdges([]);
      toast.success("Loaded initial flow!");
    };

    loadData();
  }, []);

  return (
    <CounterFlowContext.Provider value={{ nodes, setNodes, edges, setEdges }}>
      {children}
    </CounterFlowContext.Provider>
  );
};

// -------------------- SIDEBAR -------------------- //
const SidebarItem = ({ type, label }: { type: NodeType; label: string }) => {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      className="border rounded-sm flex gap-1 items-center p-2 cursor-grab"
    >
      <GripVertical className="h-4 w-4 text-foreground" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
};

function CounterItems() {
  return (
    <section>
      <div className="flex flex-col gap-2 p-2">
        <SidebarItem type="display" label="Count" />
        <SidebarItem type="increment" label="Increment" />
        <SidebarItem type="decrement" label="Decrement" />
      </div>
    </section>
  );
}

// -------------------- CANVAS -------------------- //
function CounterCanvas() {
  const { nodes, setNodes, edges, setEdges } = useCounterFlow();
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as NodeType;
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node =
        type === "display"
          ? {
              id: `display-${+new Date()}`,
              type: "display",
              position,
              data: { count: 0 },
            }
          : {
              id: `${type}-${+new Date()}`,
              type: "incdec",
              position,
              data: { type },
            };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  return (
    <section className="flex-1 p-2">
      <div className="w-full h-full border rounded-md react-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={{
            display: DisplayCountNode,
            incdec: IncrementDecrementNode,
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </section>
  );
}

// -------------------- PAGE -------------------- //
export default function App() {
  return (
    <CounterFlowProvider>
      <PageContent />
    </CounterFlowProvider>
  );
}

// Child component (inside provider, safe to use context)
function PageContent() {
  const { nodes, edges } = useCounterFlow();

  const handleSave = async () => {
    toast("Saving changes...");
    await new Promise((res) => setTimeout(res, 1200));
    console.log("Saved nodes:", nodes);
    console.log("Saved edges:", edges);
    toast.success("Changes saved successfully!");
  };

  return (
    <main className="flex flex-col h-screen">
      <header className="w-full p-2 flex gap-2 justify-between border-b">
        <ModeToggle />
        <Button size="sm" onClick={handleSave}>
          Save Changes
        </Button>
      </header>
      <section className="flex flex-row gap-2 h-full">
        <CounterCanvas />
        <CounterItems />
      </section>
    </main>
  );
}
