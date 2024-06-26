import { NavBar, NavBarLink } from 'shared/lib/components/navbar/NavBar';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { useGeoFencing } from 'shared/lib/hooks/UseGeoFencing';
import { isDappnet } from 'shared/lib/util/Utils';
import styled from 'styled-components';
import tw from 'twin.macro';

const NAV_LINKS: NavBarLink[] = [
  {
    label: 'Borrow',
    to: '/borrow',
  },
  {
    label: 'Earn',
    to: isDappnet() ? 'https://earn.aloe.eth/' : 'https://earn.aloe.capital/',
    isExternal: true,
  },
];

const Nav = styled.nav`
  ${tw`fixed top-0 left-0 right-0 flex items-center h-16`}
  border-bottom: 1px solid ${GREY_700};
  background-color: rgba(6, 11, 15, 1);
  z-index: 40;
`;

export type HeaderProps = {
  checkboxes: React.ReactNode[];
};

export default function Header(props: HeaderProps) {
  const { checkboxes } = props;
  const { isAllowed: isAllowedToInteract } = useGeoFencing();

  return (
    <Nav>
      <NavBar links={NAV_LINKS} checkboxes={checkboxes} isAllowedToInteract={isAllowedToInteract} />
    </Nav>
  );
}
