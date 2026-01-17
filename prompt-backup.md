1. We need a syncedEntities schema for pairing two or more entities via an automation in such a way that toggeling any of them will toggle the others and allow some of them to only be actuators (send but not receive toggle commands, for example - a remote with no state indicator).

2. When one of the entities is able to cut power to the others, the generator will need to create a template so that scenes can affect brightness when the inital state is power=off using wait logic (wait_template + timeout) for all bulbs to join the mesh before adjusting brightness. this is also true for temprature, color, etc when the bulb supports these. template should use latest most modern syntax.

3. This setup should also support multi bulb fixtures (all controlled together, no individual control for now). for this the generator will create either a light group or a template as the dimmable entity. the logic goes:

| power | Dimmable bulbs | Dashboard entity
|----|----|
| entity | 1+ |	Template light |
| null | 1 | The bulb itself |
| null | 2+ | Light group (needs generation) |

4. we have established through a test that this works well but doesnt update the dashboard correctly. coupled with general dashboard <-> state sync issues, we need a syncing mechanism. since this is apparent only when the dashboard/view is used, we will use an invisible custom card which uses a Web Component lifecycle hook to trigger a sync for that view's entities on load using Generator-created mapping of view → entities.

5. to avoid the wall switch turning on the bulb in a very dimmed state it will be configured in z2m to allways turn on at a default brightness (this should be documented). 

6. in all these pairing types - care needs to be taken to avoid double listing paired entities in dashbords, and to specify which of the paired entities to use in dashboards.
data structure:

create a plan .md doc for these features