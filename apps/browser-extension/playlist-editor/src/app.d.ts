declare module "*.svelte" {
    import type { Component } from "svelte";
    const component: Component<any, any, any>;
    export default component;
}

declare module "svelte-paginate" {
    export const paginate: (params: {
        items: any[];
        pageSize: number;
        currentPage: number;
    }) => any[];
}
