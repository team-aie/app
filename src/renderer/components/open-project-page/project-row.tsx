import React, { FC, useContext, useState } from 'react';

import { ThemeContext } from '../../contexts';
import { Consumer, RecordingProject, SupportedTheme } from '../../types';

interface ProjectRowProps {
  project: RecordingProject | undefined;
  onClick: Consumer<RecordingProject>;
  selected: boolean;
}

export const ProjectRow: FC<ProjectRowProps> = ({ project, onClick, selected }) => {
  const { theme } = useContext(ThemeContext);
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onClick={(): void => project && onClick(project)}
      style={
        selected || hovered
          ? { filter: (theme === SupportedTheme.LIGHT && 'invert(1)') || undefined, textDecoration: 'underline' }
          : undefined
      }
      onMouseEnter={(): void => setHovered(true)}
      onMouseOut={(): void => setHovered(false)}>
      <td className={'border-bottom'}>{project && project.name}</td>
      <td className={'border-bottom'} align={'right'}>
        {project && project.lastAccessTime && project.lastAccessTime.toLocaleString()}
      </td>
    </tr>
  );
};
