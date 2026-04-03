import type {
  CameraCapture,
  CaptureSchedule,
  MeshNetwork,
  MonitoringEvent,
  PlantReport,
  PlantUnit,
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

const reportCatalog = [
  {
    diagnosis: "Healthy growth pattern",
    severity: "low" as const,
    diseases: [] as string[],
    deficiencies: [] as string[],
    anomalies: ["minor edge curl"],
    confidence: 0.96,
    summary:
      "The plant shows uniform color, stable foliage density, and no major disease markers.",
    recommendedAction: "Keep the current lighting and irrigation schedule."
  },
  {
    diagnosis: "Nutrient deficiency watch",
    severity: "medium" as const,
    diseases: [] as string[],
    deficiencies: ["nitrogen deficiency"],
    anomalies: ["chlorosis on lower leaves"],
    confidence: 0.84,
    summary:
      "The plant shows yellowing patterns that align with early nutrient imbalance.",
    recommendedAction: "Review nutrient mix concentration and inspect runoff EC."
  },
  {
    diagnosis: "Disease risk detected",
    severity: "high" as const,
    diseases: ["early blight"],
    deficiencies: [] as string[],
    anomalies: ["necrotic leaf spotting"],
    confidence: 0.81,
    summary:
      "The plant has recurring lesions and spotting that resemble early-stage disease.",
    recommendedAction: "Isolate this plant, capture a follow-up image, and prepare treatment."
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

const trayCatalog: Omit<TraySystem, "healthScore" | "status" | "lastCaptureAt">[] = [
  {
    id: "tray-basil-01",
    name: "Basil Tray A1",
    zone: "North rack",
    crop: "Basil",
    plantCount: 6,
    deviceId: "cam-greenhouse-01"
  },
  {
    id: "tray-tomato-02",
    name: "Tomato Rail B2",
    zone: "East rail",
    crop: "Tomato",
    plantCount: 6,
    deviceId: "cam-greenhouse-02"
  },
  {
    id: "tray-lettuce-03",
    name: "Lettuce Bed C1",
    zone: "South bay",
    crop: "Lettuce",
    plantCount: 6,
    deviceId: "cam-greenhouse-03"
  },
  {
    id: "tray-pepper-04",
    name: "Pepper Loop D4",
    zone: "West loop",
    crop: "Pepper",
    plantCount: 6,
    deviceId: "cam-greenhouse-04"
  }
];

const meshSeed: MeshNetwork[] = [
  {
    id: "mesh-north-01",
    name: "North propagation mesh",
    trayIds: ["tray-basil-01", "tray-tomato-02"],
    nodeCount: 2,
    status: "active",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    summary:
      "Coordinates basil and tomato trays for shared irrigation and alert routing."
  },
  {
    id: "mesh-leafy-02",
    name: "Leafy greens mesh",
    trayIds: ["tray-lettuce-03", "tray-basil-01"],
    nodeCount: 2,
    status: "draft",
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    summary:
      "Groups basil and lettuce trays for comparative health analysis and scheduling."
  }
];

const idFor = (prefix: string, seed: string | number) => `${prefix}-${seed}`;

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
  idSeed: string | number,
  offsetMinutes: number,
  level: MonitoringEvent["level"],
  title: string,
  message: string,
  trayId?: string,
  plantId?: string,
  captureId?: string
): MonitoringEvent => ({
  id: idFor("event", idSeed),
  captureId,
  trayId,
  plantId,
  level,
  title,
  message,
  createdAt: new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString()
});

const makePlant = (
  tray: Omit<TraySystem, "healthScore" | "status" | "lastCaptureAt">,
  slotNumber: number,
  meshes: MeshNetwork[]
): PlantUnit => {
  const templates: Array<{
    score: number;
    status: PlantUnit["status"];
    diagnosis: string;
  }> = [
    { score: 97, status: "healthy", diagnosis: "Healthy growth pattern" },
    { score: 88, status: "watch", diagnosis: "Nutrient deficiency watch" },
    { score: 74, status: "alert", diagnosis: "Disease risk detected" },
    { score: 93, status: "healthy", diagnosis: "Healthy growth pattern" },
    { score: 86, status: "watch", diagnosis: "Nutrient deficiency watch" },
    { score: 95, status: "healthy", diagnosis: "Healthy growth pattern" }
  ];
  const template = templates[(slotNumber - 1) % templates.length];
  const meshIds = meshes
    .filter((mesh) => mesh.trayIds.includes(tray.id))
    .map((mesh) => mesh.id);

  return {
    id: `${tray.id}-plant-${slotNumber}`,
    trayId: tray.id,
    meshIds,
    name: `${tray.crop} Plant ${slotNumber}`,
    cultivar: `${tray.crop} cultivar`,
    slotLabel: `R${Math.ceil(slotNumber / 3)}-C${((slotNumber - 1) % 3) + 1}`,
    row: Math.ceil(slotNumber / 3),
    column: ((slotNumber - 1) % 3) + 1,
    healthScore: template.score,
    status: template.status,
    lastReportAt: new Date(
      Date.now() - (slotNumber + 2) * 60 * 60 * 1000
    ).toISOString(),
    latestDiagnosis: template.diagnosis
  };
};

const makePlantReport = (
  plant: PlantUnit,
  capture: CameraCapture,
  variantIndex: number
): PlantReport => {
  const template = reportCatalog[variantIndex % reportCatalog.length];

  return {
    id: `${plant.id}-report`,
    trayId: plant.trayId,
    plantId: plant.id,
    captureId: capture.id,
    diagnosis: template.diagnosis,
    confidence: template.confidence,
    severity: template.severity,
    diseases: template.diseases,
    deficiencies: template.deficiencies,
    anomalies: template.anomalies,
    summary: template.summary,
    recommendedAction: template.recommendedAction,
    status: template.severity === "high" ? "pending_review" : "ready",
    createdAt: plant.lastReportAt
  };
};

const makeSchedule = (
  id: string,
  scopeType: CaptureSchedule["scopeType"],
  scopeId: string,
  name: string,
  intervalMinutes: number,
  active: boolean
): CaptureSchedule => ({
  id,
  scopeType,
  scopeId,
  name,
  intervalMinutes,
  active,
  destination: "computer-vision-backend",
  nextRunAt: new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString(),
  lastRunAt: new Date(Date.now() - intervalMinutes * 60 * 1000).toISOString()
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
    const healthScores = [95, 86, 91, 73];
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

  const plants = trayCatalog.flatMap((tray) =>
    Array.from({ length: tray.plantCount }, (_value, index) =>
      makePlant(tray, index + 1, meshSeed)
    )
  );

  const reports = plants.map((plant, index) => {
    const capture =
      latestCaptureByTray.find((item) => item.trayId === plant.trayId) ?? captures[0];

    return makePlantReport(plant, capture, index);
  });

  const events = [
    makeEvent(
      "pipeline",
      2,
      "info",
      "Inference pipeline ready",
      "The mock classifier is serving tray and plant-level labels.",
      captures[0].trayId,
      undefined,
      captures[0].id
    ),
    makeEvent(
      "humidity",
      5,
      "warning",
      "Humidity drift detected",
      "Tomato Rail B2 moved 6% above the target humidity band.",
      captures[1].trayId
    ),
    makeEvent(
      "missing-frame",
      16,
      "critical",
      "Frame missing",
      "Pepper Loop D4 did not return a valid image during the previous capture window.",
      captures[3].trayId,
      undefined,
      captures[3].id
    ),
    makeEvent(
      "plant-watch",
      9,
      "warning",
      "Plant-level nutrient watch",
      "Basil Plant 2 shows chlorosis consistent with nutrient deficiency.",
      "tray-basil-01",
      "tray-basil-01-plant-2",
      captures[0].id
    ),
    makeEvent(
      "plant-alert",
      13,
      "critical",
      "Disease candidate",
      "Tomato Plant 3 is flagged for early blight risk and requires review.",
      "tray-tomato-02",
      "tray-tomato-02-plant-3",
      captures[1].id
    )
  ];

  const schedules: CaptureSchedule[] = [
    makeSchedule(
      "schedule-tray-basil",
      "tray",
      "tray-basil-01",
      "Basil daylight scan",
      120,
      true
    ),
    makeSchedule(
      "schedule-tray-tomato",
      "tray",
      "tray-tomato-02",
      "Tomato disease watch",
      90,
      true
    ),
    makeSchedule(
      "schedule-mesh-north",
      "mesh",
      "mesh-north-01",
      "North mesh coordinated scan",
      180,
      true
    )
  ];

  return {
    trays,
    plants,
    captures,
    predictions,
    reports,
    events,
    meshes: meshSeed,
    schedules,
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
