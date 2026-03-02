import {
  MdMenu, MdOutlineMouse, MdOutlinePanTool,
  MdLightMode, MdDarkMode, MdSave, MdFolderOpen, MdTimeline, MdSettings
} from 'react-icons/md';
import { useTheme } from '../../context/ThemeContext';
import { useAppStore } from '../../store/useAppStore';
import { Button } from './button';
import { Separator } from './separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip"
import { cn } from "../../utils/cn";

interface TopToolbarProps {
  activeTool: string;
  setActiveTool: (tool: string) => void;
  onMenuClick: () => void;
  onSave: () => void;
  onLoad: () => void;
}

const TopToolbar = ({ activeTool, setActiveTool, onMenuClick, onSave, onLoad }: TopToolbarProps) => {
  const { theme, toggleTheme } = useTheme();
  const { edgeType, setEdgeType, setIsSettingsModalOpen } = useAppStore();

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex justify-center pointer-events-none">
      {/* Pointer events auto only on the toolbar itself */}
      <div className="flex items-center gap-1.5 p-1.5 glass rounded-full shadow-sm pointer-events-auto border border-border/50">

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onMenuClick} className="rounded-full w-9 h-9 text-foreground hover:bg-secondary/80 hover:text-primary transition-colors">
                <MdMenu className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Toggle Sidebar</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-0.5 bg-border/50" />

          {/* Edge Type Selector */}
          <div className="px-2">
            <Select value={edgeType} onValueChange={(val: any) => setEdgeType(val)}>
              <SelectTrigger className="w-[110px] h-8 bg-transparent border-none text-xs focus:ring-0 focus:ring-offset-0 gap-1 px-1">
                <MdTimeline className="h-4 w-4 text-muted-foreground mr-1" />
                <SelectValue placeholder="Edge" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default" className="text-xs">Bezier</SelectItem>
                <SelectItem value="straight" className="text-xs">Straight</SelectItem>
                <SelectItem value="step" className="text-xs">Step</SelectItem>
                <SelectItem value="smoothstep" className="text-xs">Smooth</SelectItem>
                <SelectItem value="simplebezier" className="text-xs">Simple</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-5 mx-0.5 bg-border/50" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onSave} className="rounded-full w-9 h-9 text-foreground hover:bg-secondary/80 hover:text-emerald-500 transition-colors">
                <MdSave className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Save Project</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onLoad} className="rounded-full w-9 h-9 text-foreground hover:bg-secondary/80 hover:text-blue-500 transition-colors">
                <MdFolderOpen className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Load Project</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-0.5 bg-border/50" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'select' ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTool('select')}
                className="rounded-full w-9 h-9"
              >
                <MdOutlineMouse className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Select Tool (V)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'pan' ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTool('pan')}
                className="rounded-full w-9 h-9"
              >
                <MdOutlinePanTool className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Pan Tool (H)</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-0.5 bg-border/50" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSettingsModalOpen(true)}
                className="rounded-full w-9 h-9 hover:bg-secondary/80 hover:text-gray-600 transition-colors"
              >
                <MdSettings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>

        </TooltipProvider>

      </div>
    </div>
  );
};

export default TopToolbar;