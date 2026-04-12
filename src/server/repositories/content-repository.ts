import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  allowFallbackInProduction,
  allowSupabaseErrorFallbackInProduction,
  isProductionRuntime,
} from "@/server/config/runtime-safety";
import { SeedContentRepository } from "@/server/repositories/seed-content-repository";
import { SupabaseContentRepository } from "@/server/repositories/supabase-content-repository";
import type { ContentRepository } from "@/types/repository";

class FallbackContentRepository implements ContentRepository {
  constructor(
    private readonly primary: ContentRepository,
    private readonly fallback: ContentRepository,
  ) {}

  async listArchiveItems() {
    try {
      return await this.primary.listArchiveItems();
    } catch (error) {
      console.warn("[repository:fallback] listArchiveItems fallback to local seed", error);
      return this.fallback.listArchiveItems();
    }
  }

  async getItemBySlug(slug: string) {
    try {
      return await this.primary.getItemBySlug(slug);
    } catch (error) {
      console.warn("[repository:fallback] getItemBySlug fallback to local seed", error);
      return this.fallback.getItemBySlug(slug);
    }
  }

  async listAdminContentItems() {
    try {
      return await this.primary.listAdminContentItems();
    } catch (error) {
      console.warn(
        "[repository:fallback] listAdminContentItems fallback to local seed",
        error,
      );
      return this.fallback.listAdminContentItems();
    }
  }

  async getAdminItemById(id: string) {
    try {
      return await this.primary.getAdminItemById(id);
    } catch (error) {
      console.warn("[repository:fallback] getAdminItemById fallback to local seed", error);
      return this.fallback.getAdminItemById(id);
    }
  }

  async createManualContentItem(input: Parameters<ContentRepository["createManualContentItem"]>[0]) {
    try {
      return await this.primary.createManualContentItem(input);
    } catch (error) {
      console.warn(
        "[repository:fallback] createManualContentItem fallback to local manual store",
        error,
      );
      return this.fallback.createManualContentItem(input);
    }
  }

  async updateContentItem(input: Parameters<ContentRepository["updateContentItem"]>[0]) {
    try {
      return await this.primary.updateContentItem(input);
    } catch (error) {
      console.warn("[repository:fallback] updateContentItem fallback to local store", error);
      return this.fallback.updateContentItem(input);
    }
  }

  async setContentItemStatus(
    id: string,
    status: Parameters<ContentRepository["setContentItemStatus"]>[1],
  ) {
    try {
      return await this.primary.setContentItemStatus(id, status);
    } catch (error) {
      console.warn("[repository:fallback] setContentItemStatus fallback to local store", error);
      return this.fallback.setContentItemStatus(id, status);
    }
  }

  async listSourceChannels() {
    try {
      return await this.primary.listSourceChannels();
    } catch (error) {
      console.warn("[repository:fallback] listSourceChannels fallback to local store", error);
      return this.fallback.listSourceChannels();
    }
  }

  async createSourceChannel(input: Parameters<ContentRepository["createSourceChannel"]>[0]) {
    try {
      return await this.primary.createSourceChannel(input);
    } catch (error) {
      console.warn("[repository:fallback] createSourceChannel fallback to local store", error);
      return this.fallback.createSourceChannel(input);
    }
  }

  async runSourceSync(
    sourceId: string,
    options?: Parameters<ContentRepository["runSourceSync"]>[1],
  ) {
    try {
      return await this.primary.runSourceSync(sourceId, options);
    } catch (error) {
      console.warn("[repository:fallback] runSourceSync fallback to local store", error);
      return this.fallback.runSourceSync(sourceId, options);
    }
  }

  async runAllActiveSourceSync(options?: Parameters<ContentRepository["runAllActiveSourceSync"]>[0]) {
    try {
      return await this.primary.runAllActiveSourceSync(options);
    } catch (error) {
      console.warn(
        "[repository:fallback] runAllActiveSourceSync fallback to local store",
        error,
      );
      return this.fallback.runAllActiveSourceSync(options);
    }
  }

  async getImportRunById(id: string) {
    try {
      return await this.primary.getImportRunById(id);
    } catch (error) {
      console.warn("[repository:fallback] getImportRunById fallback to local store", error);
      return this.fallback.getImportRunById(id);
    }
  }

  async listImportRuns(limit?: number) {
    try {
      return await this.primary.listImportRuns(limit);
    } catch (error) {
      console.warn("[repository:fallback] listImportRuns fallback to local store", error);
      return this.fallback.listImportRuns(limit);
    }
  }

  async listCommentsForContentItem(
    contentItemId: string,
    options?: Parameters<ContentRepository["listCommentsForContentItem"]>[1],
  ) {
    try {
      return await this.primary.listCommentsForContentItem(contentItemId, options);
    } catch (error) {
      console.warn("[repository:fallback] listCommentsForContentItem fallback to local store", error);
      return this.fallback.listCommentsForContentItem(contentItemId, options);
    }
  }

  async createComment(input: Parameters<ContentRepository["createComment"]>[0]) {
    try {
      return await this.primary.createComment(input);
    } catch (error) {
      console.warn("[repository:fallback] createComment fallback to local store", error);
      return this.fallback.createComment(input);
    }
  }

  async getCommentById(commentId: string) {
    try {
      return await this.primary.getCommentById(commentId);
    } catch (error) {
      console.warn("[repository:fallback] getCommentById fallback to local store", error);
      return this.fallback.getCommentById(commentId);
    }
  }

  async setCommentModeration(input: Parameters<ContentRepository["setCommentModeration"]>[0]) {
    try {
      return await this.primary.setCommentModeration(input);
    } catch (error) {
      console.warn("[repository:fallback] setCommentModeration fallback to local store", error);
      return this.fallback.setCommentModeration(input);
    }
  }

  async listModerationComments(
    filters?: Parameters<ContentRepository["listModerationComments"]>[0],
  ) {
    try {
      return await this.primary.listModerationComments(filters);
    } catch (error) {
      console.warn("[repository:fallback] listModerationComments fallback to local store", error);
      return this.fallback.listModerationComments(filters);
    }
  }

  async listCommentFeedbackForCommentIds(commentIds: string[]) {
    try {
      return await this.primary.listCommentFeedbackForCommentIds(commentIds);
    } catch (error) {
      console.warn(
        "[repository:fallback] listCommentFeedbackForCommentIds fallback to local store",
        error,
      );
      return this.fallback.listCommentFeedbackForCommentIds(commentIds);
    }
  }

  async upsertCommentFeedback(input: Parameters<ContentRepository["upsertCommentFeedback"]>[0]) {
    try {
      return await this.primary.upsertCommentFeedback(input);
    } catch (error) {
      console.warn("[repository:fallback] upsertCommentFeedback fallback to local store", error);
      return this.fallback.upsertCommentFeedback(input);
    }
  }

  async getAuthorCommentReputation(
    input: Parameters<ContentRepository["getAuthorCommentReputation"]>[0],
  ) {
    try {
      return await this.primary.getAuthorCommentReputation(input);
    } catch (error) {
      console.warn("[repository:fallback] getAuthorCommentReputation fallback to local store", error);
      return this.fallback.getAuthorCommentReputation(input);
    }
  }

  async listReactionsForContentItem(contentItemId: string) {
    try {
      return await this.primary.listReactionsForContentItem(contentItemId);
    } catch (error) {
      console.warn(
        "[repository:fallback] listReactionsForContentItem fallback to local store",
        error,
      );
      return this.fallback.listReactionsForContentItem(contentItemId);
    }
  }

  async upsertReaction(input: Parameters<ContentRepository["upsertReaction"]>[0]) {
    try {
      return await this.primary.upsertReaction(input);
    } catch (error) {
      console.warn("[repository:fallback] upsertReaction fallback to local store", error);
      return this.fallback.upsertReaction(input);
    }
  }

  async listTaxonomy() {
    try {
      return await this.primary.listTaxonomy();
    } catch (error) {
      console.warn("[repository:fallback] listTaxonomy fallback to local seed", error);
      return this.fallback.listTaxonomy();
    }
  }
}

let repositoryInstance: ContentRepository | null = null;

export function getContentRepository() {
  if (repositoryInstance) {
    return repositoryInstance;
  }

  const isProduction = isProductionRuntime();
  const seedRepository = new SeedContentRepository();

  if (!isSupabaseConfigured()) {
    if (isProduction && !allowFallbackInProduction()) {
      throw new Error(
        "Supabase is not configured in production and fallback is disabled by policy.",
      );
    }

    repositoryInstance = seedRepository;
    return repositoryInstance;
  }

  const supabaseRepository = new SupabaseContentRepository();
  if (isProduction && !allowSupabaseErrorFallbackInProduction()) {
    repositoryInstance = supabaseRepository;
    return repositoryInstance;
  }

  repositoryInstance = new FallbackContentRepository(
    supabaseRepository,
    seedRepository,
  );
  return repositoryInstance;
}
