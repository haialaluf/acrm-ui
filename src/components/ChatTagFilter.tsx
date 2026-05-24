import useBoundStore from "@/stores/useBoundStore";
import TagFilter from "@/components/TagFilter";

export default function ChatTagFilter() {
  const tagsFilter = useBoundStore((state) => state.ui.tagsFilter);
  const setTagsFilter = useBoundStore((state) => state.ui.setTagsFilter);

  return (
    <TagFilter
      value={tagsFilter}
      onChange={setTagsFilter}
      className="px-[20px] pb-[5px]"
    />
  );
}
