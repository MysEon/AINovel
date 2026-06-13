import React from 'react';
import { Modal } from 'antd';
import CharacterCreatorTabs from './CharacterCreatorTabs';
import './FirstCharacterOnboardingModal.css';

const FirstCharacterOnboardingModal = ({
  open,
  projectId,
  onCreated,
  templateRegistry,
  templateLoading,
}) => (
  <Modal
    open={open}
    footer={null}
    closable={false}
    maskClosable={false}
    keyboard={false}
    width={920}
    className="first-character-onboarding-modal"
    destroyOnClose={false}
    title={null}
  >
    <div className="first-character-onboarding-header">
      <h2 className="first-character-onboarding-title">请先创建第一个角色</h2>
      <p className="first-character-onboarding-subtitle">
        项目至少需要一个角色才能开始写作。可以手动填写，或用一段描述让 AI 自动生成。
      </p>
    </div>
    <CharacterCreatorTabs
      projectId={projectId}
      templateRegistry={templateRegistry}
      templateLoading={templateLoading}
      onCreated={onCreated}
    />
  </Modal>
);

export default FirstCharacterOnboardingModal;
