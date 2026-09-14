# Image-to-3D observation and continuation ledger

Reference: office-concept.png, generated for this task. Object domain: furnishing (sofa).
Observation: low rectangular sofa, bilateral silhouette, forest green upholstery, rounded arms, repeated seat cushions, dark recessed plinth. Cushions contact the seat frame; arms enclose the seat laterally; back rises behind the seat. Matte dielectric cloth contrasts with a darker support frame. The single oblique view hides the rear and underside.

Implementation contract: preserve the existing simulation's 4 × 1.5 footprint; use distinct cushion, arm, back, foot and plinth meshes, beveled cloth edges, exported normals and PBR materials. Three cushions, six upholstery buttons, two loose pillows and brass feet are original design inferences, not observed reference details. No screenshot or projected room artwork substitutes for geometry.

Route: direct Blender modeling and GLB export, consumed by Three.js in the office and Babylon.js in the furnishing viewer. The image2threejs generic checklist is retained as an unfinished reference-reconstruction record; no automated fidelity gate or exact-reference score is claimed. This is a design-led app upgrade, not exact reconstruction of the generated room layout. Existing room layout, collisions and character animations take precedence over the concept's invented room plan.

Runtime verification: export and view the actual GLB in both engines; inspect silhouette and joins from multiple camera angles. Functional preservation is verified separately from visual resemblance. No rejected review has been removed or changed.
