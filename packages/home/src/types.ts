import type {
  HomeActionResult,
  HomeAction,
  HomeEntity,
  HomeEvent,
  HomePillar,
} from "@alfred/type";

export type { HomeActionResult, HomeAction, HomeEntity, HomeEvent, HomePillar };

export interface HomeProviderClient {
  listEntities(pillar?: HomePillar): Promise<HomeEntity[]>;
  getEntity(entityId: string): Promise<HomeEntity>;
  act(action: HomeAction): Promise<HomeActionResult>;
  ping(): Promise<boolean>;
}
