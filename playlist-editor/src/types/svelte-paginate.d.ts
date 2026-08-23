declare module "svelte-paginate" {
    import { SvelteComponent } from "svelte";

    export interface PaginateArgs {
        items: any[];
        pageSize: number;
        currentPage: number;
    }

    export function paginate(args: PaginateArgs): any[];

    export class PaginationNav extends SvelteComponent<{
        totalItems: number;
        pageSize: number;
        currentPage: number;
        limit?: number;
        showStepOptions?: boolean;
    }> {}
}
