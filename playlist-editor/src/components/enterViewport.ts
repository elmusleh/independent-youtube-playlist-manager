export function enterViewport(node: HTMLElement, params: { threshold?: number } = {}) {
    if (typeof IntersectionObserver === "undefined") {
        node.classList.add("enterVisible");
        return { destroy() { } };
    }

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    node.classList.add("enterVisible");
                    observer.unobserve(node);
                }
            }
        },
        {
            threshold: params.threshold ?? 0.12,
        }
    );

    observer.observe(node);

    return {
        destroy() {
            observer.disconnect();
        },
    };
}
