import { createUniqueId, type ComponentProps } from "solid-js"

export function Wordmark(
  props: Pick<ComponentProps<"svg">, "class"> & { fade?: boolean; muted?: boolean; outline?: boolean },
) {
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 627.6923 129"
      fill="none"
      classList={{
        [props.class ?? ""]: !!props.class,
        "overflow-visible [&_path]:[vector-effect:non-scaling-stroke]": props.outline,
      }}
    >
      <g opacity={props.muted === false ? 1 : 0.6} class="[[data-color-scheme=dark]_&]:opacity-100">
        <g mask={props.fade === false ? undefined : `url(#${mask})`}>
          <g
            opacity={props.muted === false ? 1 : 0.16 * 0.7}
            fill={props.outline ? "none" : "currentColor"}
            stroke={props.outline ? "currentColor" : undefined}
            stroke-width={props.outline ? 1 : undefined}
          >
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M55.3846 36.4286H18.4615V91.7143H55.3846V36.4286ZM73.8462 110.143H0V18H73.8462V110.143Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M110.462 91.7143H147.385V36.4286H110.462V91.7143ZM165.846 110.143H110.462V128.571H92V18H165.846V110.143Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M258.846 73.2857H203.462V91.7143H258.846V110.143H185V18H258.846V73.2857ZM203.462 54.8571H240.385V36.4286H203.462V54.8571Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M332.385 36.4286H295.462V110.143H277V18H332.385V36.4286ZM350.846 110.143H332.385V36.4286H350.846V110.143Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M369.2308 0H387.6923V18.4286H443.0769V110.5714H369.2308ZM424.6154 36.8571H387.6923V92.1429H424.6154Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M516.9231 36.8571H480V110.5714H461.5385V18.4286H516.9231ZM535.3846 110.5714H516.9231V36.8571H535.3846Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M553.8462 0H572.3077V110.5714H553.8462ZM609.2308 18.4286H627.6923V36.8571H609.2308ZM590.7692 36.8571H609.2308V55.2857H590.7692ZM572.3077 55.2857H590.7692V73.7143H572.3077ZM590.7692 73.7143H609.2308V92.1429H590.7692ZM609.2308 92.1429H627.6923V110.5714H609.2308Z"
            />
          </g>
        </g>
      </g>
      <defs>
        <mask id={mask} style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="627.6923" height="129">
          <rect width="627.6923" height="129" fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient id={maskGradient} x1="313.8462" y1="68" x2="313.8462" y2="129" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
