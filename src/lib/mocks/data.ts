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
    recommendation: "No change.",
    score: 0.97
  },
  {
    label: "Early blight risk",
    severity: "medium" as const,
    recommendation: "Inspect canopy; re-image in 24h.",
    score: 0.88
  },
  {
    label: "Leaf spot anomaly",
    severity: "high" as const,
    recommendation: "Manual inspection; consider treatment.",
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
    summary: "Color and density look normal.",
    recommendedAction: "Keep current light and water."
  },
  {
    diagnosis: "Nutrient deficiency watch",
    severity: "medium" as const,
    diseases: [] as string[],
    deficiencies: ["nitrogen deficiency"],
    anomalies: ["chlorosis on lower leaves"],
    confidence: 0.84,
    summary: "Lower leaves yellowing; possible N shortage.",
    recommendedAction: "Check EC/pH and feed rate."
  },
  {
    diagnosis: "Disease risk detected",
    severity: "high" as const,
    diseases: ["early blight"],
    deficiencies: [] as string[],
    anomalies: ["necrotic leaf spotting"],
    confidence: 0.81,
    summary: "Spots match early blight pattern.",
    recommendedAction: "Isolate; re-shoot; prep fungicide if confirmed."
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

type TraySeedEntry = Pick<
  TraySystem,
  "id" | "name" | "zone" | "crop" | "plantCount" | "deviceId"
>;

const trayCatalog: TraySeedEntry[] = [
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
    summary: "Basil + tomato on one alert group."
  },
  {
    id: "mesh-leafy-02",
    name: "Leafy greens mesh",
    trayIds: ["tray-lettuce-03", "tray-basil-01"],
    nodeCount: 2,
    status: "draft",
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    summary: "Lettuce and basil compared on the same schedule."
  }
];

const idFor = (prefix: string, seed: string | number) => `${prefix}-${seed}`;

const makeCapture = (
  tray: TraySeedEntry,
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
  notes: missing ? "Stale frame." : "OK."
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

const plantPreviewUrl = (
  capture: CameraCapture | undefined,
  trayId: string,
  slotNumber: number
) => {
  if (capture?.imageUrl) {
    const sep = capture.imageUrl.includes("?") ? "&" : "?";
    return `${capture.imageUrl}${sep}plant=${trayId}-${slotNumber}`;
  }
  return `/images/test-image.jpg?v=${trayId}-p${slotNumber}`;
};

const makePlant = (
  tray: TraySeedEntry,
  slotNumber: number,
  meshes: MeshNetwork[],
  trayCapture?: CameraCapture
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
    cultivar:
      tray.crop === "Tomato"
        ? "Cherry cascade"
        : tray.crop === "Basil"
          ? "Genovese"
          : tray.crop === "Lettuce"
            ? "Butterhead"
            : `${tray.crop} (grow)`,
    description: null,
    plantIdentifier: null,
    slotLabel: `R${Math.ceil(slotNumber / 3)}-C${((slotNumber - 1) % 3) + 1}`,
    row: Math.ceil(slotNumber / 3),
    column: ((slotNumber - 1) % 3) + 1,
    healthScore: template.score,
    status: template.status,
    lastReportAt: new Date(
      Date.now() - (slotNumber + 2) * 60 * 60 * 1000
    ).toISOString(),
    latestDiagnosis: template.diagnosis,
    lastImageUrl: plantPreviewUrl(trayCapture, tray.id, slotNumber),
    lastImageAt:
      trayCapture?.capturedAt ??
      new Date(Date.now() - (slotNumber + 1) * 45 * 60 * 1000).toISOString()
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
      visionPlantCount: null,
      visionPlantCountAt: null,
      visionPlantCountConfidence: null,
      visionDetections: null,
      healthScore: healthScores[index],
      status: statuses[index],
      deviceId: capture.deviceId,
      lastCaptureAt: capture.capturedAt
    };
  });

  const plants = trayCatalog.flatMap((tray) => {
    const cap = latestCaptureByTray.find((c) => c.trayId === tray.id);
    return Array.from({ length: tray.plantCount }, (_value, index) =>
      makePlant(tray, index + 1, meshSeed, cap)
    );
  });

  const reports = plants.flatMap((plant, index) => {
    const capture =
      latestCaptureByTray.find((item) => item.trayId === plant.trayId) ?? captures[0];

    const latest = makePlantReport(plant, capture, index);
    const t0 = new Date(latest.createdAt).getTime();
    const older: PlantReport = {
      ...latest,
      id: `${plant.id}-r72`,
      severity: "low",
      diagnosis: "Healthy growth pattern",
      summary: "Earlier check: no issues.",
      confidence: 0.94,
      diseases: [],
      deficiencies: [],
      recommendedAction: "No change.",
      status: "ready",
      createdAt: new Date(t0 - 72 * 3600000).toISOString()
    };
    const mid: PlantReport = {
      ...latest,
      id: `${plant.id}-r36`,
      severity: index % 4 === 0 ? "medium" : "low",
      diagnosis: index % 4 === 0 ? "Nutrient deficiency watch" : "Healthy growth pattern",
      summary: index % 4 === 0 ? "Slight yellowing noted." : "Stable.",
      confidence: index % 4 === 0 ? 0.82 : 0.91,
      diseases: [],
      deficiencies: index % 4 === 0 ? ["nitrogen deficiency"] : [],
      recommendedAction: index % 4 === 0 ? "Check EC." : "No change.",
      status: "ready",
      createdAt: new Date(t0 - 36 * 3600000).toISOString()
    };
    return [older, mid, { ...latest, id: `${plant.id}-r0` }];
  });

  const events = [
    makeEvent(
      "pipeline",
      2,
      "info",
      "Model online",
      "Classifier up; tray + plant labels enabled.",
      captures[0].trayId,
      undefined,
      captures[0].id
    ),
    makeEvent(
      "humidity",
      5,
      "warning",
      "Humidity high",
      "Tomato Rail B2: +6% vs setpoint.",
      captures[1].trayId
    ),
    makeEvent(
      "missing-frame",
      16,
      "critical",
      "No frame",
      "Pepper Loop D4: empty capture window.",
      captures[3].trayId,
      undefined,
      captures[3].id
    ),
    makeEvent(
      "plant-watch",
      9,
      "warning",
      "Nutrient watch",
      "Basil plant 2: chlorosis on lower leaves.",
      "tray-basil-01",
      "tray-basil-01-plant-2",
      captures[0].id
    ),
    makeEvent(
      "plant-alert",
      13,
      "critical",
      "Disease flag",
      "Tomato plant 3: possible early blight.",
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

/** Map model output + reference catalog into a structured plant report. */
export const buildPlantReportFromPrediction = (
  plant: PlantUnit,
  capture: CameraCapture,
  prediction: PredictionResult
): PlantReport => {
  const idx =
    prediction.severity === "high" ? 2 : prediction.severity === "medium" ? 1 : 0;
  const template = reportCatalog[idx];

  return {
    id: `${plant.id}-report-${capture.id}`,
    trayId: plant.trayId,
    plantId: plant.id,
    captureId: capture.id,
    diagnosis: template.diagnosis,
    confidence: prediction.confidence,
    severity: template.severity,
    diseases: [...template.diseases],
    deficiencies: [...template.deficiencies],
    anomalies: [...template.anomalies],
    summary: `${template.summary} Model: ${prediction.label}.`,
    recommendedAction: template.recommendedAction,
    status: prediction.severity === "high" ? "pending_review" : "ready",
    createdAt: capture.capturedAt
  };
};

export const mockSimilarMatches = similarityCatalog;
