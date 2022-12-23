import { NavBar, NavBarLink } from 'shared/lib/components/navbar/NavBar';
import styled from 'styled-components';
import tw from 'twin.macro';

const NAV_LINKS: NavBarLink[] = [
  {
    label: 'Earn',
    to: '/earn',
  },
  {
    label: 'Markets',
    to: '/markets',
  },
];

const Nav = styled.nav`
  ${tw`fixed top-0 left-0 right-0 flex items-center h-16`}
  border-bottom: 1px solid rgba(26, 41, 52, 1);
  background-color: rgba(6, 11, 15, 1);
  z-index: 40;
`;

export default function Header() {
  return (
    <Nav>
      <NavBar links={NAV_LINKS} isAllowedToInteract={true} />
    </Nav>
  );
}
