"""Original Corporate Claw furniture, authored in Blender. Run blender -b -P scripts/build_furnishings.py."""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0,rough=.6):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough
 return m
fabric=material('Forest woven upholstery',(.025,.12,.09),0,.87)
walnut=material('Walnut frame',(.16,.065,.025),0,.45)
brass=material('Brushed brass',(.5,.32,.12),.75,.32)
cream=material('Linen cushions',(.66,.62,.5),0,.95)
def box(name,loc,scale,mat,bevel=.05):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat)
 if bevel:
  b=o.modifiers.new('Tailored soft edges','BEVEL'); b.width=bevel; b.segments=3; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
 o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); return o
# Blender Z up. Footprint exactly matches existing sofa collision footprint.
box('Walnut plinth',(0,0,.24),(3.9,1.4,.25),walnut,.04)
box('Upholstered seat base',(0,0,.49),(3.95,1.5,.33),fabric,.12)
for x in [-1.78,1.78]:
 box('Rounded upholstered arm',(x,0,.94),(.38,1.5,.87),fabric,.15)
 for y in [-.55,.55]: box('Brass foot',(x,y,.11),(.09,.09,.22),brass,.02)
for i,x in enumerate([-1.05,0,1.05]):
 box('Seat cushion '+str(i),(x,-.03,.72),(1.0,1.24,.23),fabric,.1)
 o=box('Back cushion '+str(i),(x,.55,1.18),(1.03,.3,.98),fabric,.12);o.rotation_euler.x=-.1
 for z in [1.04,1.36]:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.033,location=(x,.375,z));bpy.context.object.name='Upholstery button';bpy.context.object.data.materials.append(fabric)
for x,ang in [(-1.3,-.2),(1.3,.2)]:
 o=box('Loose linen cushion',(x,.1,1.05),(.5,.22,.5),cream,.1);o.rotation_euler.y=ang
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'docs/visuals/lounge-sofa.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models/lounge-sofa.glb'),export_format='GLB',export_apply=True)
print('Exported original lounge sofa')
