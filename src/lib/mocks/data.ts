import type {
  CameraCapture,
  MeshNetwork,
  MonitoringEvent,
  PredictionResult,
  SimilarImageMatch,
  TraySystem
} from "@/lib/types/domain";

const predictionCatalog = [
  {
    label: "Healthy leaf tissue",
    severity: "low" as const,
    recommendation: "No immediate action required. Continue normal irrigation.",
    score: 0.97
  },
  {
    label: "Early blight risk",
    severity: "medium" as const,
    recommendation:
      "Inspect the affected bed and isolate nearby leaves for closer review.",
    score: 0.88
  },
  {
    label: "Leaf spot anomaly",
    severity: "high" as const,
    recommendation:
      "Trigger a manual inspection and prepare treatment workflow for the row.",
    score: 0.82
  }
];

const similarityCatalog: SimilarImageMatch[] = [
  {
    id: "similar-1",
    label: "Healthy basil reference",
    score: 0.96,
    imageUrl: "/images/test-image.jpg?v=reference-1"
  },
  {
    id: "similar-2",
    label: "Tomato leaf stress cluster",
    score: 0.89,
    imageUrl: "/images/test-image.jpg?v=reference-2"
  },
  {
    id: "similar-3",
    label: "Localized blight reference",
    score: 0.84,
    imageUrl: "/images/test-image.jpg?v=reference-3"
  }
];

const idFor = (prefix: string, offset: number) => `${prefix}-${offset}`;

const trayCatalog: Omit<TraySystem, "healthScore" | "status" | "lastCaptureAt">[] = [
  {
    id: "tray-basil-01",
    name: "Basil Tray A1",
    zone: "North rack",
    crop: "Basil",
    plantCount: 18,
    deviceId: "cam-greenhouse-01"
  },
  {
    id: "tray-tomato-02",
    name: "Tomato Rail B2",
    zone: "East rail",
    crop: "Tomato",
    plantCount: 12,
    deviceId: "cam-greenhouse-02"
  },
  {
    id: "tray-lettuce-03",
    name: "Lettuce Bed C1",
    zone: "South bay",
    crop: "Lettuce",
    plantCount: 24,
    deviceId: "cam-greenhouse-03"
  },
  {
    id: "tray-pepper-04",
    name: "Pepper Loop D4",
    zone: "West loop",
    crop: "Pepper",
    plantCount: 16,
    deviceId: "cam-greenhouse-04"
  }
];

const makeCapture = (
  tray: Omit<TraySystem, "healthScore" | "status" | "lastCaptureAt">,
  offsetMinutes: number,
  missing = false
): CameraCapture => ({
  id: `${tray.id}-${idFor("capture", offsetMinutes)}`,
  trayId: tray.id,
  trayName: tray.name,
  deviceId: tray.deviceId,
  imageUrl: missing
    ? null
    : `/images/test-image.jpg?v=${tray.id}-${offsetMinutes.toString(36)}`,
  capturedAt: new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString(),
  source: "simulator",
  status: missing ? "missing" : "available",
  notes: missing
    ? `${tray.name} reported a stale frame. Placeholder engaged.`
    : `${tray.name} frame normalized for dashboard preview.`
});

const makePrediction = (
  capture: CameraCapture,
  variantIndex: number
): PredictionResult => {
  const template = predictionCatalog[variantIndex % predictionCatalog.length];

  return {
    id: `${capture.id}-prediction`,
    captureId: capture.id,
    trayId: capture.trayId,
    label: template.label,
    confidence: template.score,
    severity: template.severity,
    recommendation: template.recommendation,
    vectorSource: "mock",
    createdAt: capture.capturedAt,
    similarMatches: similarityCatalog
  };
};

const makeEvent = (
  offsetMinutes: number,
  level: MonitoringEvent["level"],
  title: string,
  message: string,
  trayId?: string,
  captureId?: string
): MonitoringEvent => ({
  id: idFor("event", offsetMinutes),
  captureId,
  trayId,
  level,
  title,
  message,
  createdAt: new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString()
});

export const createMockSeed = () => {
  const captures = [
    makeCapture(trayCatalog[0], 4),
    makeCapture(trayCatalog[1], 7),
    makeCapture(trayCatalog[2], 11),
    makeCapture(trayCatalog[3], 16, true),
    makeCapture(trayCatalog[0], 28),
    makeCapture(trayCatalog[1], 33),
    makeCapture(trayCatalog[2], 39),
    makeCapture(trayCatalog[3], 45)
  ];
  const predictions = captures
    .filter((capture) => capture.imageUrl)
    .map((capture, index) => makePrediction(capture, index));
  const latestCaptureByTray = trayCatalog.map((tray) =>
    captures.find((capture) => capture.trayId === tray.id) as CameraCapture
  );
  const trays: TraySystem[] = latestCaptureByTray.map((capture, index) => {
    const healthScores = [96, 88, 91, 72];
    const statuses: TraySystem["status"][] = [
      "healthy",
      "watch",
      "healthy",
      "alert"
    ];

    return {
      id: capture.trayId,
      name: capture.trayName,
      zone: trayCatalog[index].zone,
      crop: trayCatalog[index].crop,
      plantCount: trayCatalog[index].plantCount,
      healthScore: healthScores[index],
      status: statuses[index],
      deviceId: capture.deviceId,
      lastCaptureAt: capture.capturedAt
    };
  });
  const events = [
    makeEvent(
      2,
      "info",
      "Inference pipeline ready",
      "The mock classifier is serving vector matches and summary labels.",
      captures[0]?.trayId,
      captures[0]?.id
    ),
    makeEvent(
      5,
      "warning",
      "Humidity drift detected",
      "Tomato Rail B2 moved 6% above the target humidity band.",
      captures[1]?.trayId,
      captures[0]?.id
    ),
    makeEvent(
      16,
      "critical",
      "Frame missing",
      "Pepper Loop D4 did not return a valid image during the previous capture window.",
      captures[3]?.trayId,
      captures[2]?.id
    ),
    makeEvent(
      21,
      "info",
      "Camera heartbeat restored",
      "Lettuce Bed C1 resumed image transmission after watchdog reset.",
      captures[2]?.trayId,
      captures[1]?.id
    ),
    makeEvent(
      9,
      "warning",
      "Localized nutrient watch",
      "Basil Tray A1 shows mild stress near the outer edge of the tray.",
      captures[0]?.trayId,
      captures[0]?.id
    )
  ];
  const meshes: MeshNetwork[] = [
    {
      id: "mesh-north-01",
      name: "North propagation mesh",
      trayIds: [trayCatalog[0].id, trayCatalog[1].id],
      nodeCount: 2,
      status: "active",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      summary: "Coordinates basil and tomato trays for shared irrigation and alert routing."
    }
  ];

  return {
    trays,
    captures,
    predictions,
    events,
    meshes,
    lastRotationAt: Date.now()
  };
};

export const derivePredictionFromCapture = (
  capture: CameraCapture
): PredictionResult => {
  const variantIndex = capture.id.length % predictionCatalog.length;

  return makePrediction(capture, variantIndex);
};

export const mockSimilarMatches = similarityCatalog;
