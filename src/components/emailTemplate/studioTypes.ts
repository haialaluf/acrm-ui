/* The vendor SDK's option type, re-exported under one name.
 *
 * `@grapesjs/studio-sdk/react` exports the component but not the shape of its
 * `options` prop, so everything that builds part of that object (studioTheme,
 * the builder shell) would otherwise have to reach into the package's internal
 * paths. Keeping the one reach-in here means a rename upstream breaks one line. */
import type { CreateEditorOptions } from "@grapesjs/studio-sdk";

export type StudioEditorOptions = CreateEditorOptions;
