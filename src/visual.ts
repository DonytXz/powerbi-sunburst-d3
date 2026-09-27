"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import { VisualFormattingSettingsModel } from "./settings";
import { ISunburstRawNode, ISunburstViewModel, ISunburstSettings } from "./types";
import { transformDataView, formatNumber } from "./transform";

type RectNode = d3.HierarchyRectangularNode<ISunburstRawNode>;

export class Visual implements IVisual {
    private events: IVisualEventService;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private formattingSettingsService: FormattingSettingsService;
    private formattingSettings: VisualFormattingSettingsModel;

    private rootElement: HTMLElement;
    private breadcrumbsContainer: HTMLElement;
    private chartArea: HTMLElement;
    private landingPage: HTMLElement;

    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private mainGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private slicesGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private labelsGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private centerGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

    private centerCircle: d3.Selection<SVGCircleElement, unknown, null, undefined>;
    private centerTitleText: d3.Selection<SVGTextElement, unknown, null, undefined>;
    private centerValueText: d3.Selection<SVGTextElement, unknown, null, undefined>;
    private centerHintText: d3.Selection<SVGTextElement, unknown, null, undefined>;

    private currentViewModel: ISunburstViewModel | null = null;
    private currentFocusNode: RectNode | null = null;
    private currentRootNode: RectNode | null = null;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
        this.formattingSettingsService = new FormattingSettingsService();
        this.formattingSettings = new VisualFormattingSettingsModel();

        this.rootElement = options.element;
        this.rootElement.classList.add("sunburst-root");

        // 1. Breadcrumbs container
        this.breadcrumbsContainer = document.createElement("div");
        this.breadcrumbsContainer.className = "sunburst-breadcrumbs-bar";
        this.rootElement.appendChild(this.breadcrumbsContainer);

        // 2. Chart Area
        this.chartArea = document.createElement("div");
        this.chartArea.className = "sunburst-chart-area";
        this.rootElement.appendChild(this.chartArea);

        // 3. Landing Page (Empty State)
        this.landingPage = document.createElement("div");
        this.landingPage.className = "sunburst-landing-page";

        const landingTitle = document.createElement("h2");
        landingTitle.textContent = "Interactive D3 Sunburst";

        const landingDesc = document.createElement("p");
        landingDesc.textContent = "To render this visual, drag multi-level categories into Hierarchy Levels and a numeric field into Value.";

        const badgesContainer = document.createElement("div");
        badgesContainer.className = "landing-badges";

        const badge1 = document.createElement("span");
        badge1.className = "badge";
        badge1.textContent = "\u2192 Hierarchy Levels";

        const badge2 = document.createElement("span");
        badge2.className = "badge";
        badge2.textContent = "\u2192 Value";

        const badge3 = document.createElement("span");
        badge3.className = "badge";
        badge3.textContent = "\u2192 Tooltips (Optional)";

        badgesContainer.appendChild(badge1);
        badgesContainer.appendChild(badge2);
        badgesContainer.appendChild(badge3);

        this.landingPage.appendChild(landingTitle);
        this.landingPage.appendChild(landingDesc);
        this.landingPage.appendChild(badgesContainer);
        this.rootElement.appendChild(this.landingPage);

        // 4. Initialize SVG using D3
        this.svg = d3.select(this.chartArea)
            .append("svg")
            .attr("class", "sunburst-svg");

        this.mainGroup = this.svg.append("g").attr("class", "main-group");
        this.slicesGroup = this.mainGroup.append("g").attr("class", "slices-group");
        this.labelsGroup = this.mainGroup.append("g").attr("class", "labels-group");
        this.centerGroup = this.mainGroup.append("g").attr("class", "center-group");

        this.centerCircle = this.centerGroup.append("circle").attr("class", "center-circle");
        this.centerTitleText = this.centerGroup.append("text").attr("class", "center-text-title").attr("dy", "-0.6em");
        this.centerValueText = this.centerGroup.append("text").attr("class", "center-text-value").attr("dy", "0.7em");
        this.centerHintText = this.centerGroup.append("text").attr("class", "center-text-hint").attr("dy", "2.1em").text("Click to Zoom Out");

        // Center circle click zooms out to parent
        this.centerCircle.on("click", (event: MouseEvent) => {
            event.stopPropagation();
            if (this.currentFocusNode && this.currentFocusNode.parent) {
                this.zoomTo(this.currentFocusNode.parent);
            }
        });

        // Background click clears selection
        this.svg.on("click", () => {
            this.selectionManager.clear().then(() => {
                this.slicesGroup.selectAll<SVGPathElement, RectNode>(".sunburst-slice")
                    .classed("selected", false)
                    .classed("dimmed", false);
            });
        });
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);

        try {
            const dataView = options.dataViews && options.dataViews[0];
            if (!dataView) {
                this.showLandingPage(true);
                this.events.renderingFinished(options);
                return;
            }

            // Populate formatting model
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                dataView
            );

            // Transform data
            const viewModel = transformDataView(dataView.categorical, this.host);
            this.currentViewModel = viewModel;

            if (!viewModel.hasData || !viewModel.root) {
                this.showLandingPage(true);
                this.events.renderingFinished(options);
                return;
            }

            this.showLandingPage(false);

            // Settings extraction
            const settings = this.extractSettings();

            // Dimensions
            const width = Math.max(options.viewport.width, 100);
            const height = Math.max(options.viewport.height, 100);
            const breadcrumbHeight = settings.showBreadcrumbs ? 36 : 0;
            const availableHeight = Math.max(height - breadcrumbHeight, 80);
            const radius = Math.min(width, availableHeight) / 2 - 8;

            this.svg
                .attr("width", width)
                .attr("height", availableHeight);

            this.mainGroup.attr("transform", `translate(${width / 2}, ${availableHeight / 2})`);

            // Build D3 Hierarchy
            const hierarchy = d3.hierarchy<ISunburstRawNode>(viewModel.root)
                .sum(d => (d.children && d.children.length > 0) ? 0 : (d.value || 0))
                .sort((a, b) => (b.value || 0) - (a.value || 0));

            const partition = d3.partition<ISunburstRawNode>()
                .size([2 * Math.PI, radius]);

            const rootNode = partition(hierarchy) as RectNode;
            this.currentRootNode = rootNode;

            // Preserve focus node if still existing in hierarchy, else reset to root
            if (!this.currentFocusNode || !this.findMatchingNode(rootNode, this.currentFocusNode)) {
                this.currentFocusNode = rootNode;
            } else {
                this.currentFocusNode = this.findMatchingNode(rootNode, this.currentFocusNode) || rootNode;
            }

            // Render chart
            this.renderChart(rootNode, radius, settings);
            this.updateBreadcrumbs(this.currentFocusNode, settings);
            this.updateCenterDisplay(this.currentFocusNode, radius, settings);

            this.events.renderingFinished(options);
        } catch (error) {
            console.error("Error in Sunburst update", error);
            this.events.renderingFailed(options, String(error));
        }
    }

    private extractSettings(): ISunburstSettings {
        const chartCard = this.formattingSettings.chartConfigCard;
        const labelsCard = this.formattingSettings.labelsConfigCard;
        const breadcrumbsCard = this.formattingSettings.breadcrumbsConfigCard;
        const centerCard = this.formattingSettings.centerConfigCard;

        return {
            innerRadiusRatio: Number(chartCard.innerRadiusRatio.value) || 0.25,
            padAngle: Number(chartCard.padAngle.value) || 0.005,
            cornerRadius: Number(chartCard.cornerRadius.value) || 3,
            animationDuration: Number(chartCard.animationDuration.value) || 750,
            colorScheme: (chartCard.colorScheme.value && chartCard.colorScheme.value.value) ? String(chartCard.colorScheme.value.value) : "tableau10",
            showLabels: labelsCard.show.value ?? true,
            labelFontSize: Number(labelsCard.fontSize.value) || 10,
            labelFontColor: labelsCard.fontColor.value.value || "#2d3748",
            showBreadcrumbs: breadcrumbsCard.show.value ?? true,
            breadcrumbFontSize: Number(breadcrumbsCard.fontSize.value) || 12,
            breadcrumbFontColor: breadcrumbsCard.fontColor.value.value || "#1a202c",
            showCenterSummary: centerCard.show.value ?? true,
            centerTitle: centerCard.title.value || "Total",
            centerFontSize: Number(centerCard.fontSize.value) || 14
        };
    }

    private getColorScale(colorScheme: string): d3.ScaleOrdinal<string, string> {
        let palette: readonly string[] = d3.schemeTableau10;
        switch (colorScheme) {
            case "category10":
                palette = d3.schemeCategory10;
                break;
            case "paired":
                palette = d3.schemePaired;
                break;
            case "accent":
                palette = d3.schemeAccent;
                break;
            case "spectral":
                palette = ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"];
                break;
            default:
                palette = d3.schemeTableau10;
                break;
        }
        return d3.scaleOrdinal<string, string>(palette);
    }

    private renderChart(rootNode: RectNode, radius: number, settings: ISunburstSettings) {
        const colorScale = this.getColorScale(settings.colorScheme);
        const focus = this.currentFocusNode || rootNode;
        const innerHole = radius * settings.innerRadiusRatio;

        // Scales mapped to current focus
        const x = d3.scaleLinear()
            .domain([focus.x0, focus.x1])
            .range([0, 2 * Math.PI])
            .clamp(true);

        const y = d3.scaleLinear()
            .domain([focus.y0, radius])
            .range([innerHole, radius])
            .clamp(true);

        // Arc generator
        const arc = d3.arc<RectNode>()
            .startAngle(d => x(d.x0))
            .endAngle(d => x(d.x1))
            .padAngle(d => Math.min((x(d.x1) - x(d.x0)) / 2, settings.padAngle))
            .padRadius(radius / 2)
            .innerRadius(d => Math.max(0, y(d.y0)))
            .outerRadius(d => Math.max(y(d.y0), y(d.y1) - 1))
            .cornerRadius(settings.cornerRadius);

        // Filter out root slice itself (center hole represents it)
        const visibleDescendants = rootNode.descendants().filter(d => d.depth > 0);

        // Slices Data Join
        const slices = this.slicesGroup
            .selectAll<SVGPathElement, RectNode>(".sunburst-slice")
            .data(visibleDescendants, d => (d.data.path ? d.data.path.join("/") : d.data.name));

        // Enter
        const slicesEnter = slices.enter()
            .append("path")
            .attr("class", "sunburst-slice")
            .attr("fill", d => {
                // Color by top-level ancestor category
                let topAncestor = d;
                while (topAncestor.depth > 1 && topAncestor.parent) {
                    topAncestor = topAncestor.parent as RectNode;
                }
                return colorScale(topAncestor.data.name);
            });

        // Merge & Draw
        slicesEnter.merge(slices)
            .attr("d", d => arc(d))
            .style("display", d => this.isNodeVisible(d, focus) ? null : "none");

        // Interaction Handlers
        slicesEnter.merge(slices)
            .on("click", (event: MouseEvent, d: RectNode) => {
                event.stopPropagation();

                // If slice has children, drill-down/zoom in
                if (d.children && d.children.length > 0) {
                    this.zoomTo(d);
                }

                // Handle Power BI Selection
                if (d.data.selectionId) {
                    const multiSelect = event.ctrlKey || event.metaKey;
                    this.selectionManager.select(d.data.selectionId, multiSelect).then(ids => {
                        const hasSelection = ids && ids.length > 0;
                        this.slicesGroup.selectAll<SVGPathElement, RectNode>(".sunburst-slice")
                            .classed("selected", node => ids.some(id => (id as powerbi.visuals.ISelectionId).equals(node.data.selectionId as powerbi.visuals.ISelectionId)))
                            .classed("dimmed", node => hasSelection && !ids.some(id => (id as powerbi.visuals.ISelectionId).equals(node.data.selectionId as powerbi.visuals.ISelectionId)));
                    });
                }
            })
            .on("contextmenu", (event: MouseEvent, d: RectNode) => {
                event.preventDefault();
                event.stopPropagation();
                if (d.data.selectionId) {
                    this.selectionManager.showContextMenu(d.data.selectionId, {
                        x: event.clientX,
                        y: event.clientY
                    });
                }
            })
            .on("mouseover", (event: MouseEvent, d: RectNode) => {
                const tooltips = d.data.tooltipItems || [
                    { displayName: "Category", value: d.data.name },
                    { displayName: "Value", value: formatNumber(d.value || 0) }
                ];

                this.host.tooltipService.show({
                    coordinates: [event.clientX, event.clientY],
                    isTouchEvent: false,
                    dataItems: tooltips,
                    identities: d.data.selectionId ? [d.data.selectionId] : []
                });
            })
            .on("mousemove", (event: MouseEvent) => {
                this.host.tooltipService.move({
                    coordinates: [event.clientX, event.clientY],
                    isTouchEvent: false,
                    dataItems: [],
                    identities: []
                });
            })
            .on("mouseout", () => {
                this.host.tooltipService.hide({
                    immediately: true,
                    isTouchEvent: false
                });
            });

        // Exit
        slices.exit().remove();

        // Labels
        if (settings.showLabels) {
            this.renderLabels(visibleDescendants, focus, arc, x, y, settings);
        } else {
            this.labelsGroup.selectAll("*").remove();
        }
    }

    private renderLabels(
        nodes: RectNode[],
        focus: RectNode,
        arc: d3.Arc<any, RectNode>,
        x: d3.ScaleLinear<number, number>,
        y: d3.ScaleLinear<number, number>,
        settings: ISunburstSettings
    ) {
        const visibleLabels = nodes.filter(d => {
            if (!this.isNodeVisible(d, focus)) return false;
            const angleSpan = x(d.x1) - x(d.x0);
            return angleSpan > 0.08; // Min arc angle to display text
        });

        const labels = this.labelsGroup
            .selectAll<SVGTextElement, RectNode>(".sunburst-label")
            .data(visibleLabels, d => (d.data.path ? d.data.path.join("/") : d.data.name));

        const labelsEnter = labels.enter()
            .append("text")
            .attr("class", "sunburst-label")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em");

        labelsEnter.merge(labels)
            .attr("transform", d => {
                const angle = (x(d.x0) + x(d.x1)) / 2 * 180 / Math.PI;
                const r = (y(d.y0) + y(d.y1)) / 2;
                return `rotate(${angle - 90}) translate(${r},0) rotate(${angle < 180 ? 0 : 180})`;
            })
            .attr("font-size", `${settings.labelFontSize}px`)
            .attr("fill", settings.labelFontColor)
            .text(d => {
                const availableAngle = x(d.x1) - x(d.x0);
                const maxChars = Math.floor(availableAngle * 12);
                const name = d.data.name;
                if (maxChars < 3) return "";
                return name.length > maxChars ? name.slice(0, maxChars - 1) + "\u2026" : name;
            });

        labels.exit().remove();
    }

    private isNodeVisible(node: RectNode, focus: RectNode): boolean {
        // Node is visible if it's a descendant of focus and within radial range
        let current: RectNode | null = node;
        while (current) {
            if (current === focus) return true;
            current = current.parent as RectNode | null;
        }
        return false;
    }

    private zoomTo(targetNode: RectNode) {
        if (!this.currentRootNode) return;

        this.currentFocusNode = targetNode;
        const settings = this.extractSettings();
        const width = this.svg.node()?.clientWidth || 400;
        const height = this.svg.node()?.clientHeight || 400;
        const radius = Math.min(width, height) / 2 - 8;

        this.renderChart(this.currentRootNode, radius, settings);
        this.updateBreadcrumbs(targetNode, settings);
        this.updateCenterDisplay(targetNode, radius, settings);
    }

    private updateCenterDisplay(node: RectNode, radius: number, settings: ISunburstSettings) {
        if (!settings.showCenterSummary) {
            this.centerGroup.style("display", "none");
            return;
        }

        this.centerGroup.style("display", null);
        const innerHole = radius * settings.innerRadiusRatio;
        this.centerCircle.attr("r", Math.max(15, innerHole - 2));

        const isRoot = !node.parent;
        const total = node.value || 0;
        const formatted = formatNumber(total);

        this.centerTitleText
            .attr("font-size", `${Math.max(9, settings.centerFontSize - 4)}px`)
            .text(isRoot ? settings.centerTitle : node.data.name);

        this.centerValueText
            .attr("font-size", `${Math.max(11, settings.centerFontSize)}px`)
            .text(formatted);

        this.centerHintText
            .style("display", isRoot ? "none" : null);
    }

    private updateBreadcrumbs(node: RectNode, settings: ISunburstSettings) {
        if (!settings.showBreadcrumbs) {
            this.breadcrumbsContainer.style.display = "none";
            return;
        }

        this.breadcrumbsContainer.style.display = "flex";
        this.breadcrumbsContainer.replaceChildren();

        const pathNodes: RectNode[] = [];
        let curr: RectNode | null = node;
        while (curr) {
            pathNodes.unshift(curr);
            curr = curr.parent as RectNode | null;
        }

        pathNodes.forEach((pNode, index) => {
            if (index > 0) {
                const sep = document.createElement("span");
                sep.className = "crumb-separator";
                sep.textContent = "/";
                this.breadcrumbsContainer.appendChild(sep);
            }

            const item = document.createElement("span");
            item.className = "crumb-item" + (index === pathNodes.length - 1 ? " crumb-active" : "");
            item.style.fontSize = `${settings.breadcrumbFontSize}px`;
            item.textContent = index === 0 ? "Total" : pNode.data.name;

            item.addEventListener("click", () => {
                this.zoomTo(pNode);
            });

            this.breadcrumbsContainer.appendChild(item);
        });
    }

    private findMatchingNode(root: RectNode, target: RectNode): RectNode | null {
        if (!target.data.path) return null;
        const targetPath = target.data.path.join("/");
        for (const desc of root.descendants() as RectNode[]) {
            if (desc.data.path && desc.data.path.join("/") === targetPath) {
                return desc;
            }
        }
        return null;
    }

    private showLandingPage(show: boolean) {
        this.landingPage.style.display = show ? "flex" : "none";
        this.chartArea.style.display = show ? "none" : "block";
        this.breadcrumbsContainer.style.display = show ? "none" : "flex";
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}