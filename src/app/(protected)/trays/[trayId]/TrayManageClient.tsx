"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import type { PlantHealthStatus, PlantUnit, TraySystem } from "@/lib/types/domain";

export function TrayManageClient({ tray }: { tray: TraySystem }) {
  const router = useRouter();
  const [tName, setTName] = useState(tray.name);
  const [tZone, setTZone] = useState(tray.zone);
  const [tCrop, setTCrop] = useState(tray.crop);
  const [tDevice, setTDevice] = useState(tray.deviceId);
  const [trayBusy, setTrayBusy] = useState(false);
  const [trayErr, setTrayErr] = useState<string | null>(null);

  const [pName, setPName] = useState("");
  const [pCultivar, setPCultivar] = useState("");
  const [pRow, setPRow] = useState("");
  const [pCol, setPCol] = useState("");
  const [pSlot, setPSlot] = useState("");
  const [pId, setPId] = useState("");
  const [pHealth, setPHealth] = useState("88");
  const [pStatus, setPStatus] = useState<PlantHealthStatus>("healthy");
  const [pDiag, setPDiag] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [plantBusy, setPlantBusy] = useState(false);
  const [plantErr, setPlantErr] = useState<string | null>(null);
  const [plantOk, setPlantOk] = useState<string | null>(null);

  useEffect(() => {
    setTName(tray.name);
    setTZone(tray.zone);
    setTCrop(tray.crop);
    setTDevice(tray.deviceId);
  }, [tray.id, tray.name, tray.zone, tray.crop, tray.deviceId]);

  async function saveTray() {
    setTrayErr(null);
    setTrayBusy(true);
    try {
      const res = await fetch(`/api/trays/${encodeURIComponent(tray.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tName.trim(),
          zone: tZone.trim(),
          crop: tCrop.trim(),
          deviceId: tDevice.trim() || "manual"
        })
      });
      const json = (await res.json()) as { data?: TraySystem; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save tray");
      router.refresh();
    } catch (e) {
      setTrayErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setTrayBusy(false);
    }
  }

  async function addPlant() {
    setPlantErr(null);
    setPlantOk(null);
    setPlantBusy(true);
    try {
      const rowN = pRow.trim() === "" ? undefined : Number(pRow);
      const colN = pCol.trim() === "" ? undefined : Number(pCol);
      if (
        (pRow.trim() !== "" && pCol.trim() === "") ||
        (pCol.trim() !== "" && pRow.trim() === "")
      ) {
        throw new Error("Enter both row and column, or leave both empty for auto layout");
      }
      if (rowN !== undefined && (!Number.isFinite(rowN) || rowN < 1)) {
        throw new Error("Row must be a positive integer");
      }
      if (colN !== undefined && (!Number.isFinite(colN) || colN < 1)) {
        throw new Error("Column must be a positive integer");
      }

      const healthN = pHealth.trim() === "" ? undefined : Number(pHealth);
      if (healthN !== undefined && (!Number.isFinite(healthN) || healthN < 0 || healthN > 100)) {
        throw new Error("Health must be between 0 and 100");
      }

      const body: Record<string, unknown> = {
        name: pName.trim(),
        cultivar: pCultivar.trim(),
        trayId: tray.id
      };
      if (rowN !== undefined) body.row = rowN;
      if (colN !== undefined) body.column = colN;
      if (pSlot.trim()) body.slotLabel = pSlot.trim();
      if (pId.trim()) body.plantIdentifier = pId.trim();
      if (pDesc.trim()) body.description = pDesc.trim();
      if (healthN !== undefined) body.healthScore = Math.round(healthN);
      body.status = pStatus;
      if (pDiag.trim()) body.latestDiagnosis = pDiag.trim();

      const res = await fetch("/api/plants/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = (await res.json()) as { data?: PlantUnit; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not add plant");

      setPlantOk("Plant added.");
      setPName("");
      setPCultivar("");
      setPRow("");
      setPCol("");
      setPSlot("");
      setPId("");
      setPHealth("88");
      setPStatus("healthy");
      setPDiag("");
      setPDesc("");
      router.refresh();
    } catch (e) {
      setPlantErr(e instanceof Error ? e.message : "Error");
    } finally {
      setPlantBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Tray settings</p>
        <p className="mt-0.5 text-xs text-ink/40">
          Name, location, and crop shown across the app.
        </p>
        {trayErr && (
          <p className="mt-2 text-sm text-rose-600" role="alert">
            {trayErr}
          </p>
        )}
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Name</span>
            <input
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              disabled={trayBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Zone</span>
            <input
              value={tZone}
              onChange={(e) => setTZone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              disabled={trayBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Crop</span>
            <input
              value={tCrop}
              onChange={(e) => setTCrop(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              disabled={trayBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Device ID</span>
            <input
              value={tDevice}
              onChange={(e) => setTDevice(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 font-mono text-sm focus:border-leaf focus:outline-none"
              maxLength={64}
              disabled={trayBusy}
            />
          </label>
          <Button
            type="button"
            className="px-3 py-2 text-xs"
            disabled={trayBusy || !tName.trim() || !tZone.trim() || !tCrop.trim()}
            onClick={() => void saveTray()}
          >
            {trayBusy ? "Saving…" : "Save tray"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Add plant manually</p>
        <p className="mt-0.5 text-xs text-ink/40">
          Set grid position, slot label, ID tag, and health. Leave row/column empty to auto-place.
        </p>
        {plantErr && (
          <p className="mt-2 text-sm text-rose-600" role="alert">
            {plantErr}
          </p>
        )}
        {plantOk && (
          <p className="mt-2 text-sm text-emerald-700" role="status">
            {plantOk}
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Name</span>
            <input
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              placeholder="Basil"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Species / cultivar</span>
            <input
              value={pCultivar}
              onChange={(e) => setPCultivar(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              placeholder="Ocimum basilicum"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Row</span>
            <input
              value={pRow}
              onChange={(e) => setPRow(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              placeholder="Auto"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Column</span>
            <input
              value={pCol}
              onChange={(e) => setPCol(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              placeholder="Auto"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Slot label</span>
            <input
              value={pSlot}
              onChange={(e) => setPSlot(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={32}
              placeholder="e.g. R2C1 or NFC-A7"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Plant ID (label, RFID, lab code)</span>
            <input
              value={pId}
              onChange={(e) => setPId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 font-mono text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              placeholder="Optional"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Health (0–100)</span>
            <input
              value={pHealth}
              onChange={(e) => setPHealth(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Status</span>
            <select
              value={pStatus}
              onChange={(e) => setPStatus(e.target.value as PlantHealthStatus)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              disabled={plantBusy}
            >
              <option value="healthy">healthy</option>
              <option value="watch">watch</option>
              <option value="alert">alert</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Latest condition / diagnosis</span>
            <input
              value={pDiag}
              onChange={(e) => setPDiag(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={160}
              placeholder="Optional — overrides default “Awaiting first photo”"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Notes</span>
            <textarea
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={4000}
              placeholder="Optional notes"
              disabled={plantBusy}
            />
          </label>
        </div>
        <Button
          type="button"
          className="mt-4 w-full sm:w-auto"
          disabled={plantBusy || !pName.trim() || !pCultivar.trim()}
          onClick={() => void addPlant()}
        >
          {plantBusy ? "Adding…" : "Add plant to this tray"}
        </Button>
      </Card>
    </div>
  );
}
