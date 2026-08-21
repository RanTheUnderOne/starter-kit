"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiError } from "@/lib/api";
import type {
  ClawHubSkillSummary,
  ClawHubSkillsResponse,
  SkillContentResponse,
  SkillInstallResult,
  SkillMeta,
  SkillsResponse,
} from "@/lib/minions/types";

const basePath = (agentId: string) => `/api/agents/${agentId}/minions/skills`;

function relativePathFor(file: File) {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relative && relative.length > 0 ? relative : file.name;
}

export function useSkills(agentId: string) {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [registrySkills, setRegistrySkills] = useState<ClawHubSkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<SkillsResponse>(basePath(agentId));
      setSkills(data.skills);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || "Couldn't load skills.");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const loadRegistry = useCallback(async (query = "") => {
    setRegistryLoading(true);
    try {
      const params = new URLSearchParams({ limit: "24" });
      if (query.trim()) params.set("q", query.trim());
      const endpoint = query.trim() ? "registry/search" : "registry/browse";
      const data = await apiFetch<ClawHubSkillsResponse>(`${basePath(agentId)}/${endpoint}?${params}`);
      setRegistrySkills(data.skills);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || "Couldn't load the skills registry.");
    } finally {
      setRegistryLoading(false);
    }
  }, [agentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadRegistry(); }, [loadRegistry]);

  const installSkill = useCallback(async (skill: ClawHubSkillSummary) => {
    const data = await apiFetch<SkillInstallResult>(`${basePath(agentId)}/install`, {
      method: "POST",
      body: JSON.stringify({
        provider: "clawhub",
        slug: skill.slug,
        ownerHandle: skill.ownerHandle ?? undefined,
        version: skill.version ?? skill.latestVersion ?? undefined,
      }),
    });
    await load();
    return data;
  }, [agentId, load]);

  const importSkills = useCallback(async (files: File[]) => {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file, file.name);
      form.append("relativePaths", relativePathFor(file));
    }
    // Do not set Content-Type here: the browser supplies the multipart boundary.
    const response = await fetch(`${basePath(agentId)}/import`, { method: "POST", body: form });
    if (!response.ok) throw new Error(await readApiError(response, "Couldn't import the skill"));
    const data = (await response.json()) as SkillInstallResult;
    await load();
    return data;
  }, [agentId, load]);

  const deleteSkill = useCallback(async (skill: SkillMeta) => {
    await apiFetch(`${basePath(agentId)}/${encodeURIComponent(skill.id)}`, { method: "DELETE" });
    await load();
  }, [agentId, load]);

  const installedContent = useCallback(async (skill: SkillMeta) => {
    return apiFetch<SkillContentResponse>(`${basePath(agentId)}/${encodeURIComponent(skill.id)}/content`);
  }, [agentId]);

  const registryContent = useCallback(async (skill: ClawHubSkillSummary) => {
    const params = new URLSearchParams();
    if (skill.version ?? skill.latestVersion) params.set("version", skill.version ?? skill.latestVersion ?? "");
    if (skill.ownerHandle) params.set("ownerHandle", skill.ownerHandle);
    const query = params.toString();
    return apiFetch<SkillContentResponse>(`${basePath(agentId)}/registry/${encodeURIComponent(skill.slug)}/content${query ? `?${query}` : ""}`);
  }, [agentId]);

  return { skills, registrySkills, loading, registryLoading, error, load, loadRegistry, installSkill, importSkills, deleteSkill, installedContent, registryContent };
}
